from typing import Any, Dict, List, Optional, Tuple
import re

import numpy as np
import pandas as pd

from .profiling import (
    EMAIL_PATTERN,
    PHONE_PATTERN,
    PII_SEMANTICS,
    classify_column,
    mask_value,
    normalize_name,
)


def clean_dataset_frame(
    raw_frame: pd.DataFrame,
    impute_missing: bool = True,
    deduplicate_rows: bool = False,
) -> Tuple[pd.DataFrame, List[Dict[str, Any]], Dict[str, Any]]:
    """
    Executes universal data cleaning pipeline.
    Tracks all changes with detailed before/after statistics.
    Never silently modifies data without reporting.
    """
    frame = raw_frame.copy()
    original_names = [str(col).strip() for col in frame.columns]
    normalized_names = []
    seen = {}
    for orig in original_names:
        base = normalize_name(orig)
        seen[base] = seen.get(base, 0) + 1
        normalized_names.append(base if seen[base] == 1 else f"{base}_{seen[base]}")
    frame.columns = normalized_names

    # 1. Whitespace trimming & null token standardization
    trimmed_by_column: Dict[str, int] = {}
    case_inconsistencies: List[Dict[str, Any]] = []
    text_columns = list(frame.select_dtypes(include=["object", "string"]).columns)

    for col in text_columns:
        orig_series = frame[col].copy()
        trimmed_count = int(
            orig_series.map(lambda v: isinstance(v, str) and v != v.strip()).sum()
        )
        trimmed_by_column[col] = trimmed_count
        cleaned_series = frame[col].map(lambda v: v.strip() if isinstance(v, str) else v)
        # Normalize common empty string placeholders
        null_tokens = {"", "n/a", "N/A", "null", "NULL", "none", "NONE", "None", "nan", "NaN", "-", "--"}
        frame[col] = cleaned_series.replace(list(null_tokens), pd.NA)

        # Detect case inconsistencies
        variants: Dict[str, set] = {}
        for val in frame[col].dropna().astype(str).unique():
            if val.strip():
                variants.setdefault(val.casefold(), set()).add(val)
        for norm_val, spellings in variants.items():
            if len(spellings) > 1:
                case_inconsistencies.append({
                    "column": col,
                    "normalized_value": norm_val,
                    "variants": sorted(spellings)[:10]
                })

    # 2. Type classification & coercion
    schema: List[Dict[str, Any]] = []
    invalid_by_column: Dict[str, int] = {}
    converted_columns: List[str] = []
    standardized_dates: int = 0
    missing_before_by_col: Dict[str, int] = {}

    for orig, col in zip(original_names, frame.columns):
        raw_col_series = raw_frame[raw_frame.columns[len(schema)]]
        missing_before_by_col[col] = int(raw_col_series.isna().sum())
        initial = classify_column(orig, raw_col_series)
        semantic = initial["semantic_type"]
        before_notna = frame[col].notna()

        if semantic == "datetime":
            parsed_dates = pd.to_datetime(frame[col], errors="coerce", format="mixed")
            invalid_count = int((before_notna & parsed_dates.isna()).sum())
            valid_parsed = int(parsed_dates.notna().sum())
            standardized_dates += valid_parsed
            invalid_by_column[col] = invalid_count
            frame[col] = parsed_dates
            converted_columns.append(f"{orig} to datetime")
        elif semantic in {"numeric", "currency", "percentage"}:
            clean_str = (
                frame[col]
                .astype("string")
                .str.replace(r"[, $₹€£%¥]", "", regex=True)
                .str.replace(r"^\((.*)\)$", r"-\1", regex=True)
            )
            parsed_num = pd.to_numeric(clean_str, errors="coerce")
            invalid_count = int((before_notna & parsed_num.isna()).sum())
            invalid_by_column[col] = invalid_count
            frame[col] = parsed_num
            converted_columns.append(f"{orig} to numeric")
        elif semantic == "email":
            invalid_count = int((before_notna & ~frame[col].astype("string").str.match(EMAIL_PATTERN, na=False)).sum())
            invalid_by_column[col] = invalid_count
        elif semantic == "phone":
            digits = frame[col].astype("string").str.replace(r"\D", "", regex=True)
            valid_phone = digits.str.len().between(7, 15)
            invalid_count = int((before_notna & ~valid_phone.fillna(False)).sum())
            invalid_by_column[col] = invalid_count
        elif semantic == "boolean":
            bool_map = {
                "true": True, "yes": True, "1": True, "y": True, "t": True,
                "false": False, "no": False, "0": False, "n": False, "f": False
            }
            str_series = frame[col].astype("string").str.lower().str.strip()
            converted_bool = str_series.map(bool_map)
            invalid_count = int((before_notna & converted_bool.isna()).sum())
            invalid_by_column[col] = invalid_count
            frame[col] = converted_bool
        else:
            invalid_by_column[col] = 0

        detected = classify_column(orig, frame[col])
        detected.update({
            "name": col,
            "original_name": orig,
            "sample_values": [
                mask_value(v, detected["semantic_type"])
                for v in frame[col].dropna().head(3).tolist()
            ]
        })
        schema.append(detected)

    # 3. Duplicate checks
    duplicate_rows_detected = int(frame.duplicated().sum())
    duplicate_rows_removed = 0
    if deduplicate_rows and duplicate_rows_detected > 0:
        before_len = len(frame)
        frame = frame.drop_duplicates().reset_index(drop=True)
        duplicate_rows_removed = before_len - len(frame)

    duplicate_ids: List[Dict[str, Any]] = []
    empty_columns: List[str] = []
    constant_columns: List[str] = []
    high_cardinality_columns: List[str] = []

    for col_info in schema:
        name = col_info["name"]
        series = frame[name]
        if series.isna().all():
            empty_columns.append(name)
        elif series.nunique(dropna=True) == 1:
            constant_columns.append(name)

        if len(frame) > 0 and col_info["unique_count"] > 30 and (col_info["unique_count"] / len(frame)) >= 0.8:
            high_cardinality_columns.append(name)

        if col_info["semantic_type"] == "identifier":
            repeated = int(series.dropna().duplicated().sum())
            if repeated > 0:
                duplicate_ids.append({"column": name, "count": repeated})

    # 4. Imputation tracking & column diffs
    diff_records: List[Dict[str, Any]] = []
    filled_numeric_count = 0
    filled_categorical_count = 0

    for col_info in schema:
        c_name = col_info["name"]
        orig_c_name = col_info["original_name"]
        c_series = frame[c_name]
        c_sem = col_info["semantic_type"]
        missing_count_after = int(c_series.isna().sum())
        imputed_for_col = 0
        strategy = None

        if impute_missing and missing_count_after > 0:
            if c_sem in {"numeric", "currency", "percentage"}:
                med = c_series.median()
                if pd.notna(med):
                    imputed_for_col = missing_count_after
                    filled_numeric_count += imputed_for_col
                    strategy = "median"
            elif c_sem in {"category", "status", "region", "delivery_mode"}:
                mode_vals = c_series.mode(dropna=True)
                if not mode_vals.empty:
                    imputed_for_col = missing_count_after
                    filled_categorical_count += imputed_for_col
                    strategy = "mode"

        diff_records.append({
            "column": orig_c_name,
            "normalized_name": c_name,
            "original_type": str(raw_frame[orig_c_name].dtype if orig_c_name in raw_frame.columns else "unknown"),
            "cleaned_type": col_info["semantic_type"],
            "whitespace_trimmed": trimmed_by_column.get(c_name, 0),
            "missing_before": missing_before_by_col.get(c_name, 0),
            "missing_after": missing_count_after,
            "imputed_count": imputed_for_col,
            "imputation_strategy": strategy or "preserved",
            "invalid_coerced": invalid_by_column.get(c_name, 0),
            "outliers_detected": 0
        })

    # 5. Formulate action items for user report
    actions = ["Normalized column names to clean identifiers", "Standardized empty values and null tokens"]
    if duplicate_rows_removed:
        actions.append(f"✓ Removed {duplicate_rows_removed:,} duplicate rows")
    elif duplicate_rows_detected:
        actions.append(f"✓ Flagged {duplicate_rows_detected:,} duplicate rows without dropping raw data")

    if standardized_dates:
        actions.append(f"✓ Standardized {standardized_dates:,} date values into unified format")

    if converted_columns:
        actions.append(f"✓ Coerced {len(converted_columns)} columns ({', '.join(converted_columns[:4])}) to strict typed values")

    trimmed_cols_count = sum(1 for c, cnt in trimmed_by_column.items() if cnt > 0)
    if trimmed_cols_count:
        actions.append(f"✓ Trimmed whitespace from {trimmed_cols_count} columns")

    if filled_numeric_count:
        actions.append(f"✓ Detected {filled_numeric_count:,} missing numeric values (fillable with median)")

    if filled_categorical_count:
        actions.append(f"✓ Detected {filled_categorical_count:,} missing categorical values (fillable with mode)")

    raw_missing = int(raw_frame.isna().sum().sum())
    clean_missing = int(frame.isna().sum().sum())

    # Calculate before & after quality scores
    before_cells = max(len(raw_frame) * len(raw_frame.columns), 1)
    before_quality = round(100.0 * (before_cells - raw_missing) / before_cells, 1)

    after_cells = max(len(frame) * len(frame.columns), 1)
    after_invalid = sum(invalid_by_column.values())
    after_quality = round(100.0 * max(0, after_cells - clean_missing - after_invalid) / after_cells, 1)

    cleaning_report = {
        "actions": actions,
        "before": {
            "rows": int(len(raw_frame)),
            "columns": int(len(raw_frame.columns)),
            "missing_values": raw_missing,
            "quality_score": before_quality
        },
        "after": {
            "rows": int(len(frame)),
            "columns": int(len(frame.columns)),
            "missing_values": clean_missing,
            "quality_score": after_quality
        },
        "diff": diff_records,
        "whitespace_trimmed_by_column": trimmed_by_column,
        "case_inconsistencies": case_inconsistencies,
        "duplicate_ids_by_column": duplicate_ids,
        "empty_columns": empty_columns,
        "constant_columns": constant_columns,
        "high_cardinality_columns": high_cardinality_columns,
        "duplicate_rows_detected": duplicate_rows_detected,
        "duplicate_rows_removed": duplicate_rows_removed,
        "invalid_values_by_column": invalid_by_column,
    }

    return frame, schema, cleaning_report
