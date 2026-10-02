import math
import re
from collections.abc import Iterable

import numpy as np
import pandas as pd

from .services.kpi_engine import generate_kpis
from .services.chart_engine import generate_visualizations

COLUMN_ALIASES = {
    "date": {"date", "created", "created_at", "timestamp", "order_date", "transaction_date", "sale_date", "sales_date", "invoice_date"},
    "revenue": {"revenue", "sales", "sale_amount", "sales_amount", "total_sales", "total_revenue", "net_sales", "amount", "total", "price", "value"},
    "customer": {"customer", "client", "contact"},
        "customer": {"customer", "customers", "client", "contact", "patient"},
    "region": {"region", "area", "zone", "territory", "location", "state", "city", "country"},
    "category": {"category", "type", "product_category", "segment", "product_type", "item_category"},
        "category": {"category", "type", "product", "department", "gender", "condition", "treatment", "product_category", "segment", "product_type", "item_category"},
    "status": {"status", "order_status", "lead_status"},
    "identifier": {"id", "product_id", "order_id", "record_id", "lead_id", "employee_id", "customer_id", "client_id", "contact_id"},
    "email": {"email", "email_address", "e_mail"},
    "phone": {"phone", "phone_number", "mobile", "mobile_number", "telephone", "contact_number"},
    "person": {"person", "name", "full_name", "sales_agent", "agent", "employee", "owner", "assignee"},
    "source": {"source", "channel", "lead_source", "acquisition_source"},
    "delivery_mode": {"delivery_mode", "delivery", "shipping_method", "fulfillment_method"},
    "percentage": {"percentage", "percent", "rate", "margin", "conversion_rate"},
    "currency": {"profit", "net_profit", "gross_profit", "earnings", "salary", "cost", "expense", "expenses", "income", "cash_flow", "inventory_value"},
        "currency": {"profit", "net_profit", "gross_profit", "earnings", "salary", "cost", "inventory_value"},
    "boolean": {"is_active", "active", "enabled", "verified", "delivered"},
}

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PHONE_PATTERN = re.compile(r"^\+?[0-9() .-]{7,20}$")
PII_SEMANTICS = {"email", "phone"}
DIMENSION_SEMANTICS = {"category", "status", "source", "region", "location", "delivery_mode", "person", "channel"}


def normalize_name(value: object) -> str:
    name = str(value).strip().lower()
    name = re.sub(r"[^a-z0-9]+", "_", name).strip("_")
    return name or "column"


def _name_semantic(name: str) -> tuple[str | None, float]:
    normalized = normalize_name(name)
    if normalized in {"customers", "customer_count", "number_of_customers", "num_customers", "orders", "order_count", "quantity", "units", "count", "age", "experience", "tenure", "score", "population", "headcount"}:
        return "numeric", 0.84
    for semantic in ("email", "phone", "date", "revenue", "customer", "region", "category", "status", "identifier", "person", "source", "delivery_mode", "percentage", "currency", "boolean"):
        aliases = COLUMN_ALIASES[semantic]
        if normalized in aliases:
            return ("currency" if semantic == "revenue" else semantic), 0.96
    if any(token in normalized for token in ("email", "e_mail")):
        return "email", 0.9
    if any(token in normalized for token in ("mobile", "phone", "telephone")):
        return "phone", 0.9
    if any(token in normalized for token in ("date", "time", "created")):
        return "date", 0.88
    if any(token in normalized for token in ("revenue", "sales", "amount", "price", "profit", "cost", "salary", "value", "income", "expense", "cash_flow")):
        return "currency", 0.84
    if "percent" in normalized or "rate" in normalized or "margin" in normalized:
        return "percentage", 0.82
    if normalized.endswith("_id") or normalized == "id" or normalized.endswith("_key"):
        return "identifier", 0.9
    if any(token in normalized for token in ("agent", "employee", "owner", "assignee", "person", "full_name")):
        return "person", 0.84
    if any(token in normalized for token in ("region", "location", "country", "state", "city", "zone", "territory")):
        return "region", 0.84
    if "status" in normalized or normalized.endswith("_state"):
        return "status", 0.82
    if any(token in normalized for token in ("source", "channel", "campaign", "medium")):
        return "source", 0.82
    if "delivery" in normalized or "shipping" in normalized or "fulfillment" in normalized:
        return "delivery_mode", 0.82
    if "category" in normalized or "segment" in normalized or "product_type" in normalized:
        return "category", 0.82
    if "customer" in normalized or "client" in normalized or "contact" in normalized:
        return "customer", 0.82
    if normalized.startswith("is_") or normalized.startswith("has_"):
        return "boolean", 0.78
    return None, 0.0


def classify_column(name: str, series: pd.Series) -> dict:
    non_null = series.dropna()
    values = non_null.astype(str).str.strip()
    named_semantic, named_confidence = _name_semantic(name)

    if named_semantic in PII_SEMANTICS:
        semantic, confidence = named_semantic, named_confidence
    elif named_semantic == "date":
        semantic, confidence = "datetime", named_confidence
    elif named_semantic in {"currency", "percentage", "identifier", "numeric"}:
        semantic, confidence = named_semantic, named_confidence
    elif not values.empty and values.str.contains(EMAIL_PATTERN).mean() >= 0.7:
        semantic, confidence = "email", 0.93
    elif not values.empty and pd.to_datetime(values, errors="coerce", format="mixed").notna().mean() >= 0.85:
        semantic, confidence = "datetime", 0.82
    elif named_semantic in {"customer", "region", "category", "status", "person", "source", "delivery_mode", "boolean"}:
        semantic, confidence = named_semantic, named_confidence
    elif not values.empty and values.str.match(PHONE_PATTERN).mean() >= 0.8 and values.str.replace(r"\D", "", regex=True).str.len().between(7, 15).mean() >= 0.8:
        semantic, confidence = "phone", 0.86
    elif pd.api.types.is_datetime64_any_dtype(series):
        semantic, confidence = "datetime", 0.98
    elif not values.empty and values.str.lower().isin({"true", "false", "yes", "no", "0", "1"}).mean() >= 0.9:
        semantic, confidence = "boolean", 0.85
    elif not values.empty:
        parsed_dates = pd.to_datetime(values, errors="coerce", format="mixed")
        if parsed_dates.notna().mean() >= 0.85:
            semantic, confidence = "datetime", 0.82
        else:
            numeric_values = pd.to_numeric(values.str.replace(r"[, $₹€£%]", "", regex=True), errors="coerce")
            if numeric_values.notna().mean() >= 0.85:
                semantic, confidence = "numeric", 0.88
            elif int(non_null.nunique()) <= min(30, max(2, int(len(non_null) * 0.5))):
                semantic, confidence = "category", 0.72
            else:
                semantic, confidence = "text", 0.62
    elif pd.api.types.is_numeric_dtype(series):
        semantic, confidence = "numeric", 0.8
    else:
        semantic, confidence = "unknown", 0.4

    if semantic == "date" and pd.api.types.is_datetime64_any_dtype(series):
        semantic = "datetime"
    elif semantic == "date":
        parsed_dates = pd.to_datetime(non_null, errors="coerce", format="mixed")
        if not non_null.empty and parsed_dates.notna().mean() >= 0.7:
            semantic = "datetime"

    null_percentage = round(float(series.isna().mean() * 100), 2) if len(series) else 0.0
    return {
        "column_name": name,
        "data_type": str(series.dtype),
        "semantic_type": semantic,
        "confidence": round(float(confidence), 2),
        "null_percentage": null_percentage,
        "unique_count": int(series.nunique(dropna=True)),
    }


def _mask_value(value: object, semantic: str) -> str:
    text = str(value)
    if semantic == "email":
        if "@" not in text:
            return f"{text[:1]}***"
        local, domain = text.split("@", 1)
        return f"{local[:2]}{'*' * max(2, len(local) - 2)}@{domain}"
    if semantic == "phone":
        digits = re.sub(r"\D", "", text)
        return f"{'*' * max(0, len(digits) - 4)}{digits[-4:]}" if digits else "***"
    return text[:80]


def _clean_frame(raw_frame: pd.DataFrame) -> tuple[pd.DataFrame, list[dict], dict]:
    frame = raw_frame.copy()
    original_names = [str(column).strip() for column in frame.columns]
    normalized_names = []
    seen = {}
    for original in original_names:
        base = normalize_name(original)
        seen[base] = seen.get(base, 0) + 1
        normalized_names.append(base if seen[base] == 1 else f"{base}_{seen[base]}")
    frame.columns = normalized_names

    trimmed_by_column = {}
    case_inconsistencies = []
    for column in frame.select_dtypes(include=["object", "string"]).columns:
        original_values = frame[column].copy()
        trimmed_by_column[column] = int(original_values.map(lambda value: isinstance(value, str) and value != value.strip()).sum())
        cleaned = frame[column].map(lambda value: value.strip() if isinstance(value, str) else value)
        frame[column] = cleaned.replace({"": pd.NA, "n/a": pd.NA, "N/A": pd.NA, "null": pd.NA, "NULL": pd.NA, "none": pd.NA})
        variants = {}
        for value in frame[column].dropna().astype(str).unique():
            variants.setdefault(value.casefold(), set()).add(value)
        for normalized, spellings in variants.items():
            if len(spellings) > 1:
                case_inconsistencies.append({"column": column, "normalized_value": normalized,
                                             "variants": sorted(spellings)[:10]})

    schema = []
    invalid_by_column = {}
    for original, column in zip(original_names, frame.columns):
        initial = classify_column(original, raw_frame[raw_frame.columns[len(schema)]])
        semantic = initial["semantic_type"]
        before = frame[column].notna()
        if semantic == "datetime":
            frame[column] = pd.to_datetime(frame[column], errors="coerce", format="mixed")
            invalid_by_column[column] = int((before & frame[column].isna()).sum())
        elif semantic in {"numeric", "currency", "percentage"}:
            values = frame[column].astype("string").str.replace(r"[, $₹€£%]", "", regex=True).str.replace(r"^\((.*)\)$", r"-\1", regex=True)
            frame[column] = pd.to_numeric(values, errors="coerce")
            invalid_by_column[column] = int((before & frame[column].isna()).sum())
        elif semantic == "email":
            invalid_by_column[column] = int((before & ~frame[column].astype("string").str.match(EMAIL_PATTERN, na=False)).sum())
        elif semantic == "phone":
            digits = frame[column].astype("string").str.replace(r"\D", "", regex=True)
            valid_phone = digits.str.len().between(7, 15)
            invalid_by_column[column] = int((before & ~valid_phone.fillna(False)).sum())
        else:
            invalid_by_column[column] = 0
        detected = classify_column(original, frame[column])
        detected.update({"name": column, "original_name": original,
                         "sample_values": [_mask_value(value, detected["semantic_type"]) for value in frame[column].dropna().head(3).tolist()]})
        schema.append(detected)
    duplicate_rows = int(frame.duplicated().sum())
    duplicate_ids = []
    empty_columns = []
    constant_columns = []
    high_cardinality_columns = []
    for column in schema:
        name = column["name"]
        series = frame[name]
        if series.isna().all():
            empty_columns.append(name)
        elif series.nunique(dropna=True) == 1:
            constant_columns.append(name)
        if len(frame) > 0 and column["unique_count"] > 30 and column["unique_count"] / len(frame) >= 0.8:
            high_cardinality_columns.append(name)
        if column["semantic_type"] == "identifier":
            repeated = int(series.dropna().duplicated().sum())
            if repeated:
                duplicate_ids.append({"column": name, "count": repeated})

    actions = ["Normalized column names", "Trimmed surrounding whitespace",
               "Converted detected dates and numeric values", "Preserved the raw upload"]
    if duplicate_rows:
        actions.append(f"Flagged {duplicate_rows} exact duplicate rows without removing them")
    if any(trimmed_by_column.values()):
        actions.append("Trimmed whitespace in populated cells")
    cleaning = {
        "actions": actions,
        "before": {"rows": int(len(raw_frame)), "columns": int(len(raw_frame.columns)),
                   "missing_values": int(raw_frame.isna().sum().sum())},
        "after": {"rows": int(len(frame)), "columns": int(len(frame.columns)),
                  "missing_values": int(frame.isna().sum().sum())},
        "whitespace_trimmed_by_column": trimmed_by_column,
        "case_inconsistencies": case_inconsistencies,
        "duplicate_ids_by_column": duplicate_ids,
        "empty_columns": empty_columns,
        "constant_columns": constant_columns,
        "high_cardinality_columns": high_cardinality_columns,
        "duplicate_rows_detected": duplicate_rows,
        "invalid_values_by_column": invalid_by_column,
    }
    return frame, schema, cleaning


def _semantic_column(schema: list[dict], semantic: str) -> str | None:
    matches = [column for column in schema if column["semantic_type"] == semantic]
    return matches[0]["name"] if matches else None


def _group_counts(frame: pd.DataFrame, column: str, limit: int = 10) -> list[dict]:
    values = frame[column].dropna().astype(str).value_counts().head(limit)
    return [{"label": value, "value": int(count)} for value, count in values.items()]


def _group_sums(frame: pd.DataFrame, dimension: str, metric: str, limit: int = 10) -> list[dict]:
    grouped = frame.groupby(dimension, dropna=True)[metric].sum().sort_values(ascending=False).head(limit)
    return [{"label": str(value), "value": round(float(total), 2)} for value, total in grouped.items()]


def _time_series(frame: pd.DataFrame, schema: list[dict], numeric_column: str | None) -> tuple[str | None, str | None, list[dict]]:
    date_columns = [column["name"] for column in schema if column["semantic_type"] in {"datetime", "date"}]
    date_column = next((column for column in date_columns if any(token in column for token in ("date", "created", "time", "timestamp"))), date_columns[0] if date_columns else None)
    if not date_column:
        return None, None, []
    valid = frame.dropna(subset=[date_column]).copy()
    if valid.empty:
        return date_column, None, []
    span_days = max(0, (valid[date_column].max() - valid[date_column].min()).days)
    if span_days <= 45:
        granularity, frequency = "daily", "D"
    elif span_days <= 270:
        granularity, frequency = "weekly", "W-SUN"
    elif span_days <= 1825:
        granularity, frequency = "monthly", "M"
    elif span_days <= 7300:
        granularity, frequency = "quarterly", "Q"
    else:
        granularity, frequency = "yearly", "Y"
    valid["__period"] = valid[date_column].dt.to_period(frequency)
    if numeric_column:
        grouped = valid.groupby("__period")[numeric_column].sum()
        points = [{"period": _format_period(period, granularity), "value": round(float(value), 2)} for period, value in grouped.items()]
    else:
        grouped = valid.groupby("__period").size()
        points = [{"period": _format_period(period, granularity), "value": int(value)} for period, value in grouped.items()]
    return date_column, granularity, points


def _format_period(period, granularity: str) -> str:
    if granularity == "daily":
        return period.strftime("%d %b %Y")
    if granularity == "weekly":
        return f"Week of {period.start_time.strftime('%d %b %Y')}"
    if granularity == "quarterly":
        return f"Q{period.quarter} {period.year}"
    if granularity == "yearly":
        return str(period.year)
    return period.strftime("%b %Y")


def _generate_quality(frame: pd.DataFrame, schema: list[dict], cleaning: dict) -> dict:
    rows, column_count = frame.shape
    cells = max(rows * column_count, 1)
    missing = int(frame.isna().sum().sum())
    duplicates = int(frame.duplicated().sum())
    invalid = sum(cleaning["invalid_values_by_column"].values())
    typed_columns = [column for column in schema if column["semantic_type"] in {"datetime", "date", "numeric", "currency", "percentage"}]
    typed_nonempty = sum(int(frame[column["name"]].notna().sum()) for column in typed_columns)
    components = {
        "completeness": round(100 * (cells - missing) / cells, 1),
        "uniqueness": round(100 * (rows - duplicates) / max(rows, 1), 1),
        "validity": round(100 * max(0, cells - invalid) / cells, 1),
        "consistency": round(100 * max(0, rows - duplicates - invalid) / max(rows, 1), 1),
        "type_correctness": round(100 * max(0, typed_nonempty) / max(typed_nonempty + invalid, 1), 1),
    }
    score = round(sum(components.values()) / len(components), 1)
    missing_by_column = [{"column": column["name"], "count": int(frame[column["name"]].isna().sum()),
                          "percentage": round(float(frame[column["name"]].isna().mean() * 100), 2)}
                         for column in schema if frame[column["name"]].isna().any()]
    invalid_by_column = [{"column": column, "count": count} for column, count in cleaning["invalid_values_by_column"].items() if count]
    return {"overall_score": score, "components": components, "rows": rows, "columns": column_count,
            "missing_values": missing, "missing_by_column": missing_by_column,
            "duplicate_rows": duplicates, "invalid_values": invalid, "invalid_by_column": invalid_by_column}


def analyze_dataset(raw_frame: pd.DataFrame, filename: str) -> tuple[pd.DataFrame, dict]:
    if raw_frame.empty or len(raw_frame.columns) == 0:
        raise ValueError("The uploaded dataset has no rows or columns.")
    cleaned_frame, schema, cleaning = _clean_frame(raw_frame)
    frame = cleaned_frame.copy()
    quality = _generate_quality(frame, schema, cleaning)
    pii_columns = [column["name"] for column in schema if column["semantic_type"] in PII_SEMANTICS]
    revenue_column = next((column["name"] for column in schema if column["semantic_type"] == "currency" and any(token in column["name"] for token in ("revenue", "sales", "amount", "total", "price", "value", "income")) and "price" not in column["name"]), None)
    revenue_source_columns = [revenue_column] if revenue_column else []
    derived_revenue = None
    if not revenue_column:
        price_column = next((column["name"] for column in schema if column["semantic_type"] == "currency" and "price" in column["name"]), None)
        quantity_column = next((column["name"] for column in schema if column["semantic_type"] == "numeric" and any(token in column["name"] for token in ("quantity", "units"))), None)
        if price_column and quantity_column:
            revenue_column = "__derived_revenue"
            revenue_source_columns = [price_column, quantity_column]
            frame[revenue_column] = frame[price_column] * frame[quantity_column]
            derived_revenue = {"column": revenue_column, "formula": f"{price_column} × {quantity_column}", "source_columns": revenue_source_columns}
    profit_column = next((column["name"] for column in schema if column["semantic_type"] == "currency" and any(token in column["name"] for token in ("profit", "earning"))), None)
    dimensions = []
    charts = []
    for column in schema:
        if column["semantic_type"] in DIMENSION_SEMANTICS and column["unique_count"] <= 30 and column["unique_count"] > 1:
            points = _group_counts(frame, column["name"])
            dimensions.append({"column": column["name"], "semantic_type": column["semantic_type"], "unique_count": column["unique_count"], "values": points})
            chart_points = _group_sums(frame, column["name"], revenue_column) if revenue_column else points
            measure = "revenue" if revenue_column else "records"
            charts.append({"kind": "bar", "title": f"{'Revenue' if revenue_column else 'Records'} by {column['original_name']}", "x_key": "label", "y_key": "value", "y_label": measure, "data": chart_points, "source_columns": [column["name"]] + revenue_source_columns})

    date_column, time_granularity, record_trend = _time_series(frame, schema, revenue_column)
    if record_trend:
        charts.append({"kind": "line", "title": f"{'Revenue' if revenue_column else 'Record creation'} trend", "x_key": "period", "y_key": "value", "y_label": "revenue" if revenue_column else "records", "data": record_trend, "source_columns": [date_column] + revenue_source_columns})
    charts, correlations = generate_visualizations(frame, schema, dimensions, charts, revenue_column)

    kpis = generate_kpis(frame, schema, quality, revenue_column, profit_column, date_column, record_trend, revenue_source_columns)

    numeric_statistics = []
    outlier_alerts = []
    for column in schema:
        name = column["name"]
        if column["semantic_type"] not in {"numeric", "currency", "percentage"}:
            continue
        values = frame[name].dropna()
        if values.empty:
            continue
        quartiles = values.quantile([0.25, 0.5, 0.75])
        numeric_statistics.append({"column": name, "count": int(values.size), "mean": round(float(values.mean()), 3),
                                   "median": round(float(quartiles.loc[0.5]), 3), "std": round(float(values.std()), 3) if values.size > 1 else 0.0,
                                   "min": float(values.min()), "q1": round(float(quartiles.loc[0.25]), 3),
                                   "q3": round(float(quartiles.loc[0.75]), 3), "max": float(values.max())})
        q1, q3 = quartiles.loc[0.25], quartiles.loc[0.75]
        iqr = q3 - q1
        if iqr > 0:
            outlier_count = int(((values < q1 - 1.5 * iqr) | (values > q3 + 1.5 * iqr)).sum())
            if outlier_count:
                outlier_alerts.append({"title": f"Potential outliers: {column['original_name']}", "detail": f"{outlier_count} values fall outside the 1.5×IQR range.", "severity": "medium", "source_columns": [name]})

    dataset_type, type_confidence, entities = _classify_dataset(schema)
    alerts = []
    if quality["missing_values"]:
        alerts.append({"title": "Missing data detected", "detail": f"{quality['missing_values']} empty cells across {len(quality['missing_by_column'])} columns.", "severity": "medium", "source_columns": [item["column"] for item in quality["missing_by_column"]]})
    if quality["duplicate_rows"]:
        alerts.append({"title": "Duplicate records", "detail": f"{quality['duplicate_rows']} exact duplicate rows detected; the original rows were preserved.", "severity": "medium", "source_columns": []})
    alerts.extend({"title": f"Invalid {column['semantic_type']} values", "detail": f"{cleaning['invalid_values_by_column'][column['name']]} values could not be parsed.", "severity": "high", "source_columns": [column["name"]]} for column in schema if cleaning["invalid_values_by_column"].get(column["name"], 0))
    alerts.extend({"title": f"Repeated identifier values: {item['column']}", "detail": f"{item['count']} identifier values are repeated.", "severity": "medium", "source_columns": [item["column"]]} for item in cleaning["duplicate_ids_by_column"])
    alerts.extend({"title": f"Empty column: {column}", "detail": "This column contains no usable values.", "severity": "low", "source_columns": [column]} for column in cleaning["empty_columns"])
    alerts.extend({"title": f"Constant column: {column}", "detail": "This field has one distinct non-empty value and does not segment the dataset.", "severity": "low", "source_columns": [column]} for column in cleaning["constant_columns"])
    alerts.extend({"title": f"High-cardinality field: {column}", "detail": "This field is excluded from category charts to avoid an unreadable visualization.", "severity": "low", "source_columns": [column]} for column in cleaning["high_cardinality_columns"])
    if cleaning["case_inconsistencies"]:
        alerts.append({"title": "Case-inconsistent categories", "detail": f"{len(cleaning['case_inconsistencies'])} fields contain values differing only by letter case.", "severity": "low", "source_columns": sorted({item["column"] for item in cleaning["case_inconsistencies"]})})
    alerts.extend(outlier_alerts)
    for column in schema:
        if column["semantic_type"] in DIMENSION_SEMANTICS and 1 < column["unique_count"] <= 30:
            distribution = next((item for item in dimensions if item["column"] == column["name"]), None)
            if distribution and distribution["values"] and distribution["values"][0]["value"] > len(frame) * 0.9:
                alerts.append({"title": f"Category concentration: {column['original_name']}", "detail": f"One value accounts for more than 90% of records.", "severity": "low", "source_columns": [column["name"]]})

    insights = []
    for dimension in dimensions:
        if dimension["values"]:
            if revenue_column:
                top = _group_sums(frame, dimension["column"], revenue_column, limit=1)[0]
                text = f"{top['label']} has the highest {revenue_column} ({top['value']:,.2f})."
                calculation = f"SUM({revenue_column}) grouped by {dimension['column']}"
                sources = [dimension["column"], revenue_column]
            else:
                top = dimension["values"][0]
                text = f"{top['label']} has the most records ({top['value']})."
                calculation = f"COUNT(records) grouped by {dimension['column']}"
                sources = [dimension["column"]]
            insights.append({"title": f"Top {dimension['semantic_type']}", "text": text, "source_columns": sources, "calculation": calculation})
    if date_column and record_trend:
        insights.append({"title": "Time coverage", "text": f"Records span {record_trend[0]['period']} through {record_trend[-1]['period']}.", "source_columns": [date_column], "calculation": "Minimum and maximum valid date"})
        if revenue_column and len(record_trend) > 1 and record_trend[-2]["value"]:
            growth = (record_trend[-1]["value"] / record_trend[-2]["value"] - 1) * 100
            insights.append({"title": "Latest period change", "text": f"{revenue_column} changed {growth:+.1f}% from the previous period.", "source_columns": [date_column] + revenue_source_columns, "calculation": "(latest period sum / previous period sum - 1) × 100"})
    for correlation in correlations:
        if abs(correlation["pearson"]) >= 0.7:
            direction = "positive" if correlation["pearson"] > 0 else "negative"
            insights.append({"title": "Strong numeric relationship",
                             "text": f"{correlation['x']} and {correlation['y']} have a {direction} correlation of {correlation['pearson']:.2f}.",
                             "source_columns": [correlation["x"], correlation["y"]],
                             "calculation": f"Pearson correlation, n={correlation['sample_size']}"})

    forecast = _forecast(frame, schema, revenue_column, date_column)
    report = {
        "dataset_id": None,
        "filename": filename,
        "dataset_type": dataset_type,
        "dataset_type_confidence": type_confidence,
        "detected_entities": entities,
        "rows": int(len(cleaned_frame)),
        "column_count": int(len(schema)),
        "analysis_mode": "sales" if revenue_column else "universal",
        "schema": schema,
        "columns": [{"name": item["name"], "original_name": item["original_name"], "dtype": item["data_type"], "missing_values": quality["missing_by_column"][next((i for i, m in enumerate(quality["missing_by_column"]) if m["column"] == item["name"]), 0)]["count"] if any(m["column"] == item["name"] for m in quality["missing_by_column"]) else 0, "unique_values": item["unique_count"], "semantic_type": item["semantic_type"], "confidence": item["confidence"], "null_percentage": item["null_percentage"], "sample_values": item["sample_values"]} for item in schema],
        "quality": quality,
        "quality_score": quality["overall_score"],
        "missing_values": quality["missing_values"],
        "duplicates": quality["duplicate_rows"],
        "cleaning_report": cleaning,
        "derived_metrics": [derived_revenue] if derived_revenue else [],
        "revenue_column": revenue_column,
        "sensitive_columns": [{"name": item["name"], "semantic_type": item["semantic_type"], "message": "Potentially identifiable information; values are masked in analysis."} for item in schema if item["semantic_type"] in PII_SEMANTICS],
        "dimensions": dimensions,
        "date_column": date_column,
        "time_granularity": time_granularity,
        "date_range": {"start": record_trend[0]["period"], "end": record_trend[-1]["period"]} if record_trend else None,
        "time_series": record_trend,
        "numeric_statistics": numeric_statistics,
        "correlations": correlations,
        "kpis": kpis,
        "charts": charts,
        "insights": insights,
        "forecast": forecast,
        "alerts": alerts,
        "source_filename": filename,
    }
    return cleaned_frame, report


def _classify_dataset(schema: list[dict]) -> tuple[str, float, list[str]]:
    semantics = {item["semantic_type"] for item in schema}
    names = {item["name"] for item in schema}
    original_names = {item["original_name"].lower() for item in schema}
    entities = []
    for semantic, label in (("customer", "Customers / Contacts"), ("identifier", "Product / Record IDs"), ("person", "Sales Agents / People"), ("region", "Regions / Locations"), ("delivery_mode", "Delivery Modes"), ("status", "Statuses"), ("source", "Sources / Channels"), ("datetime", "Creation Date"), ("date", "Date")):
        if semantic in semantics:
            entities.append(label)
    if {"status", "region"}.issubset(semantics) and ({"source"} & semantics or {"person"} & semantics):
        return "Customer / Lead / Sales Operations", 0.92, entities
    if any("employee" in name for name in names) and ("department" in names or "salary" in names):
        entities.extend(label for label in ("Employees", "Departments", "Salary") if label not in entities)
        return "HR / Workforce", 0.9, entities
    if any("patient" in name for name in names) and any(token in " ".join(names) for token in ("treatment", "outcome", "condition")):
        entities.extend(label for label in ("Patients", "Treatments", "Outcomes") if label not in entities)
        return "Healthcare", 0.88, entities
    if any("order" in name for name in names) and any("customer" in name for name in names) and any("product" in name for name in names):
        entities.extend(label for label in ("Orders", "Customers", "Products") if label not in entities)
        return "E-commerce", 0.9, entities
    if any(token in " ".join(names) for token in ("income", "expense", "cash_flow")):
        entities.extend(label for label in ("Income", "Expenses", "Cash Flow") if label not in entities)
        return "Finance", 0.88, entities
    if "currency" in semantics and any(token in " ".join(names) for token in ("sales", "revenue", "amount")):
        return "Sales / Revenue", 0.88, entities
    has_inventory_field = any(any(token in name for token in ("stock", "inventory", "sku")) for name in names)
    has_warehouse_field = any("warehouse" in name for name in names) and any(any(token in name for token in ("product", "quantity", "stock", "inventory")) for name in names)
    if has_inventory_field or has_warehouse_field:
        return "Inventory / Operations", 0.84, entities
    return "General Dataset", 0.68, entities


def _forecast(frame: pd.DataFrame, schema: list[dict], revenue_column: str | None, date_column: str | None) -> dict:
    if not date_column:
        return {"available": False, "reason": "No usable date column was detected.", "metric": None, "values": []}
    valid = frame.dropna(subset=[date_column]).copy()
    valid["__period"] = valid[date_column].dt.to_period("M")
    metric = revenue_column if revenue_column and revenue_column in valid.columns else None
    grouped = valid.groupby("__period")[metric].sum() if metric else valid.groupby("__period").size()
    if len(grouped) < 2:
        return {"available": False, "reason": "At least two dated periods are needed to forecast.", "metric": "revenue" if metric else "records", "values": []}
    x = np.arange(len(grouped), dtype=float)
    coefficients = np.polyfit(x, grouped.to_numpy(dtype=float), 1)
    future_x = np.arange(len(grouped), len(grouped) + 4, dtype=float)
    last_period = grouped.index[-1]
    values = []
    history = [{"period": period.strftime("%b %Y"), "value": round(float(value), 2)} for period, value in grouped.items()]
    for index, value in enumerate(np.polyval(coefficients, future_x), 1):
        period = (last_period + index).strftime("%b %Y")
        values.append({"period": period, "value": round(max(0, float(value)), 2)})
    return {"available": True, "metric": "revenue" if metric else "records", "source_columns": [date_column] + ([metric] if metric else []), "history": history, "values": values}


def generate_answer(frame: pd.DataFrame, report: dict, question: str) -> dict:
    query = normalize_name(question)
    revenue_column = report.get("revenue_column")
    revenue_sources = [revenue_column] if revenue_column else []
    for derived in report.get("derived_metrics", []):
        if derived["column"] == revenue_column and revenue_column not in frame.columns:
            frame = frame.copy()
            frame[revenue_column] = frame[derived["source_columns"][0]] * frame[derived["source_columns"][1]]
            revenue_sources = derived["source_columns"]
            break
    if "duplicate" in query:
        answer = f"{report['quality']['duplicate_rows']} exact duplicate records were detected."
        return _answer(question, answer, [f"Duplicate rows: {report['quality']['duplicate_rows']}"], [], "Count rows with identical values across all columns")
    if "missing" in query or "quality" in query:
        quality = report["quality"]
        evidence = [f"Quality score: {quality['overall_score']}%", f"Missing cells: {quality['missing_values']}", f"Duplicates: {quality['duplicate_rows']}"]
        evidence.extend(f"{item['column']}: {item['count']} missing" for item in quality["missing_by_column"][:8])
        return _answer(question, f"The dataset quality score is {quality['overall_score']}%. It has {quality['missing_values']} missing cells and {quality['duplicate_rows']} duplicate rows.", evidence, [item["column"] for item in quality["missing_by_column"]], "Completeness, uniqueness, validity, consistency and type correctness weighted equally")
    if "record" in query and any(token in query for token in ("how_many", "total", "count")):
        return _answer(question, f"The dataset contains {report['rows']:,} records.", [f"Rows: {report['rows']:,}"], [], "COUNT(dataset rows)")

    if revenue_column and any(token in query for token in ("revenue", "sales", "income")) and not _question_column(report["schema"], query):
        total = float(frame[revenue_column].sum())
        formula = f"SUM({revenue_sources[0]} × {revenue_sources[1]})" if len(revenue_sources) == 2 else f"SUM({revenue_column})"
        return _answer(question, f"Total revenue is {total:,.2f}.", [f"Total revenue: {total:,.2f}"], revenue_sources, formula)

    column = _question_column(report["schema"], query)
    if column:
        metadata = next(item for item in report["schema"] if item["name"] == column)
        if metadata["semantic_type"] in PII_SEMANTICS:
            count = int(frame[column].nunique(dropna=True))
            return _answer(question, f"There are {count:,} unique values in {metadata['original_name']}. Individual values are hidden because this field is sensitive.", [f"Unique values: {count:,}"], [column], f"COUNT(DISTINCT {column}); values masked")
        metric_column = revenue_column or next((item["name"] for item in report["schema"] if item["semantic_type"] == "currency" and any(token in item["name"] for token in ("revenue", "sales", "amount", "total", "price", "value"))), None)
        if metadata["semantic_type"] in DIMENSION_SEMANTICS and metric_column and any(token in query for token in ("revenue", "sales", "amount")):
            values = _group_sums(frame, column, metric_column, limit=8)
            if values:
                answer = f"{values[0]['label']} has the highest {metric_column} ({values[0]['value']:,.2f})."
                evidence = [f"{item['label']}: {item['value']:,.2f}" for item in values[:6]]
                sources = [column] + revenue_sources
                calculation = f"SUM({revenue_sources[0]} × {revenue_sources[1]}) grouped by {column}, sorted descending" if len(revenue_sources) == 2 else f"SUM({metric_column}) grouped by {column}, sorted descending"
                return _answer(question, answer, evidence, sources, calculation)
        if metadata["semantic_type"] in {"numeric", "currency", "percentage"}:
            values = frame[column].dropna()
            if not values.empty:
                if any(token in query for token in ("average", "mean", "avg")):
                    operation, result = "AVG", float(values.mean())
                elif "median" in query:
                    operation, result = "MEDIAN", float(values.median())
                elif any(token in query for token in ("lowest", "minimum", "smallest")):
                    operation, result = "MIN", float(values.min())
                elif any(token in query for token in ("highest", "maximum", "largest")):
                    operation, result = "MAX", float(values.max())
                else:
                    operation, result = "SUM", float(values.sum())
                return _answer(question, f"{operation.title()} {metadata['original_name']} is {result:,.2f}.",
                               [f"Count: {len(values):,}", f"Minimum: {values.min():,.2f}", f"Maximum: {values.max():,.2f}"],
                               [column], f"{operation}({column})")
        values = _group_counts(frame, column, 8)
        if not values:
            return _answer(question, f"No non-empty values are available for {metadata['original_name']}.", [], [column], f"GROUP BY {column}")
        is_percentage = any(word in query for word in ("percent", "percentage", "what_share", "what_proportion"))
        if is_percentage:
            target = next((item for item in values if normalize_name(item["label"]) in query), values[0])
            percent = round(target["value"] / max(report["rows"], 1) * 100, 1)
            answer = f"{target['label']} accounts for {percent}% of records ({target['value']:,} of {report['rows']:,})."
            calculation = f"COUNT({column}={target['label']}) / COUNT(records) × 100"
        elif "distribution" in query or "breakdown" in query:
            breakdown = ", ".join(f"{item['label']}: {item['value']:,}" for item in values)
            answer = f"Records by {metadata['original_name']}: {breakdown}."
            calculation = f"COUNT(records) grouped by {column}"
        else:
            answer = f"{values[0]['label']} has the highest count in {metadata['original_name']} ({values[0]['value']:,})."
            calculation = f"COUNT(records) grouped by {column}, sorted descending"
        evidence = [f"{item['label']}: {item['value']:,}" for item in values[:6]]
        return _answer(question, answer, evidence, [column], calculation)

    if any(token in query for token in ("trend", "monthly", "over_time")) and report["time_series"]:
        points = report["time_series"]
        evidence = [f"{item['period']}: {item['value']}" for item in points[-6:]]
        return _answer(question, f"The dataset has {len(points)} monthly periods from {points[0]['period']} to {points[-1]['period']}.", evidence, [report["date_column"]], "COUNT(records) grouped by month")

    return _answer(question, f"This {report['dataset_type']} dataset has {report['rows']:,} rows and {report['column_count']} columns. Ask about a detected field or data quality.", [f"Dataset type: {report['dataset_type']}", f"Rows: {report['rows']:,}", f"Quality: {report['quality_score']}%"], [], "Read dataset profile")


def _question_column(schema: list[dict], query: str) -> str | None:
    semantic_terms = {
        "region": ("region", "location", "area", "zone"),
        "source": ("source", "channel"),
        "status": ("status", "conversion", "delivered"),
        "delivery_mode": ("delivery", "shipping"),
        "person": ("agent", "sales_person", "employee"),
        "category": ("category", "segment", "product"),
    }
    for semantic, terms in semantic_terms.items():
        if any(term in query for term in terms):
            match = next((item["name"] for item in schema if item["semantic_type"] == semantic), None)
            if match:
                return match
    for item in schema:
        if item["name"] in query or normalize_name(item["original_name"]) in query:
            return item["name"]
    return None


def _answer(question: str, answer: str, evidence: list[str], source_columns: list[str], calculation: str) -> dict:
    return {"question": question, "answer": answer, "evidence": evidence,
            "source_columns": source_columns, "calculation": calculation}
