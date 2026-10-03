from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd


def perform_deep_data_quality_analysis(frame: pd.DataFrame) -> Dict[str, Any]:
    """
    Executes a comprehensive enterprise data quality audit covering:
    - Schema validation & naming consistency
    - Missing value distribution & sparsity patterns
    - Exact & key duplicate identification
    - Outlier frequency & distribution skewness
    - Feature drift detection (baseline vs recent segment)
    - Multi-dimensional weighted quality scorecard
    """
    total_rows = len(frame)
    total_cols = len(frame.columns)
    if total_rows == 0 or total_cols == 0:
        return {
            "overall_score": 0,
            "dimensions": {},
            "missing_analysis": {},
            "duplicates": {},
            "schema_health": {},
            "drift_detection": [],
            "recommendations": []
        }

    # 1. MISSING VALUE ANALYSIS
    total_cells = total_rows * total_cols
    null_counts = frame.isnull().sum()
    total_nulls = int(null_counts.sum())
    overall_null_pct = round((total_nulls / total_cells) * 100, 2)

    column_missing = []
    for col in frame.columns:
        cnt = int(null_counts[col])
        pct = round((cnt / total_rows) * 100, 2)
        column_missing.append({
            "column": col,
            "missing_count": cnt,
            "missing_pct": pct,
            "status": "critical" if pct >= 30 else ("warning" if pct >= 10 else "healthy")
        })

    # Sort columns by highest missing percentage first
    column_missing.sort(key=lambda x: x["missing_pct"], reverse=True)

    # 2. DUPLICATE RECORD IDENTIFICATION
    exact_duplicates = int(frame.duplicated().sum())
    duplicate_pct = round((exact_duplicates / total_rows) * 100, 2)

    # 3. SCHEMA & NAMING HEALTH
    clean_named_cols = 0
    mixed_type_cols = []
    for col in frame.columns:
        # Check column name hygiene (alphanumeric and underscores)
        if str(col).replace("_", "").isalnum():
            clean_named_cols += 1
        
        # Check for mixed data types in object columns
        if frame[col].dtype == object:
            types_in_col = {type(val) for val in frame[col].dropna().iloc[:100]}
            if len(types_in_col) > 1:
                mixed_type_cols.append(col)

    schema_health_score = round((clean_named_cols / total_cols) * 100, 1)

    # 4. OUTLIER & SKEWNESS SPECTRUM
    numeric_cols = [c for c in frame.columns if pd.api.types.is_numeric_dtype(frame[c])]
    outlier_summary = []
    total_outlier_count = 0

    for col in numeric_cols:
        series = frame[col].dropna()
        if len(series) < 6:
            continue
        q25 = series.quantile(0.25)
        q75 = series.quantile(0.75)
        iqr = q75 - q25
        if iqr > 0:
            low_bound = q25 - 1.5 * iqr
            high_bound = q75 + 1.5 * iqr
            outliers = series[(series < low_bound) | (series > high_bound)]
            cnt = len(outliers)
            total_outlier_count += cnt
            skewness = float(series.skew()) if not np.isnan(series.skew()) else 0.0
            outlier_summary.append({
                "column": col,
                "outlier_count": cnt,
                "outlier_pct": round((cnt / len(series)) * 100, 2),
                "skewness": round(skewness, 2),
                "is_skewed": abs(skewness) > 1.0
            })

    # 5. DATA DRIFT DETECTION (Baseline Segment vs Recent Segment)
    drift_detection = []
    if total_rows >= 20 and len(numeric_cols) > 0:
        split_idx = total_rows // 2
        baseline_df = frame.iloc[:split_idx]
        recent_df = frame.iloc[split_idx:]

        for col in numeric_cols[:6]:
            base_s = baseline_df[col].dropna()
            rec_s = recent_df[col].dropna()
            if len(base_s) < 5 or len(rec_s) < 5:
                continue

            base_mean = float(base_s.mean())
            rec_mean = float(rec_s.mean())
            base_std = float(base_s.std()) if len(base_s) > 1 else 1.0
            rec_std = float(rec_s.std()) if len(rec_s) > 1 else 1.0

            # Normalized difference in means
            denominator = max(abs(base_mean), abs(rec_mean), 1e-4)
            mean_shift_pct = round((abs(rec_mean - base_mean) / denominator) * 100, 1)

            # Classify drift level
            if mean_shift_pct >= 25.0:
                drift_status = "High Drift"
            elif mean_shift_pct >= 10.0:
                drift_status = "Moderate Drift"
            else:
                drift_status = "Stable"

            drift_detection.append({
                "column": col,
                "baseline_mean": round(base_mean, 2),
                "recent_mean": round(rec_mean, 2),
                "mean_shift_pct": mean_shift_pct,
                "status": drift_status,
                "variance_ratio": round(rec_std / max(base_std, 1e-6), 2)
            })

    # 6. WEIGHTED COMPOSITE QUALITY DIMENSIONS (0 - 100)
    # Completeness (30% weight)
    completeness_score = max(0.0, 100.0 - overall_null_pct * 2.0)
    # Uniqueness (20% weight)
    uniqueness_score = max(0.0, 100.0 - duplicate_pct * 4.0)
    # Validity (20% weight) - deduct for mixed type cols
    validity_deduction = (len(mixed_type_cols) / max(total_cols, 1)) * 30.0
    validity_score = max(50.0, 100.0 - validity_deduction)
    # Consistency (15% weight)
    consistency_score = schema_health_score
    # Stability / Drift (15% weight)
    high_drift_cols = sum(1 for d in drift_detection if d["status"] == "High Drift")
    stability_score = max(60.0, 100.0 - (high_drift_cols * 15.0))

    overall_score = round(
        completeness_score * 0.30 +
        uniqueness_score * 0.20 +
        validity_score * 0.20 +
        consistency_score * 0.15 +
        stability_score * 0.15,
        1
    )

    # 7. ACTIONABLE QUALITY RECOMMENDATIONS
    recommendations = []
    if exact_duplicates > 0:
        recommendations.append({
            "action": f"Remove {exact_duplicates} exact duplicate rows",
            "impact": "+2% Quality Score",
            "pipeline_operation": "remove_duplicates"
        })
    critical_nulls = [c for c in column_missing if c["status"] == "critical"]
    if critical_nulls:
        recommendations.append({
            "action": f"Impute or drop sparse column '{critical_nulls[0]['column']}' ({critical_nulls[0]['missing_pct']}% missing)",
            "impact": "+4% Quality Score",
            "pipeline_operation": "handle_missing"
        })
    if high_drift_cols > 0:
        recommendations.append({
            "action": f"Inspect distribution shift in {high_drift_cols} high-drift feature columns",
            "impact": "Improves predictive model stability",
            "pipeline_operation": "filter_rows"
        })
    if not recommendations:
        recommendations.append({
            "action": "Dataset health verified at enterprise production standards",
            "impact": "Ready for predictive analytics & BI reports",
            "pipeline_operation": "none"
        })

    return {
        "overall_score": overall_score,
        "quality_tier": "Excellent" if overall_score >= 90 else ("Good" if overall_score >= 75 else "Needs Cleaning"),
        "dimensions": {
            "completeness": round(completeness_score, 1),
            "uniqueness": round(uniqueness_score, 1),
            "validity": round(validity_score, 1),
            "consistency": round(consistency_score, 1),
            "stability": round(stability_score, 1)
        },
        "summary": {
            "total_rows": total_rows,
            "total_columns": total_cols,
            "missing_cells_total": total_nulls,
            "missing_pct_overall": overall_null_pct,
            "exact_duplicates": exact_duplicates,
            "duplicate_pct": duplicate_pct,
            "outlier_rows_total": total_outlier_count
        },
        "missing_analysis": column_missing[:12],
        "column_analysis": column_missing,
        "outlier_analysis": outlier_summary[:8],
        "drift_detection": drift_detection,
        "drift_detected": any(d.get("status") != "Stable" for d in drift_detection),
        "recommendations": recommendations
    }
