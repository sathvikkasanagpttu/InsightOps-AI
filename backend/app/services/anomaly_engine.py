import uuid
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest


def detect_anomalies(
    frame: pd.DataFrame,
    schema: List[Dict[str, Any]],
    date_column: Optional[str] = None,
    time_series: Optional[List[Dict[str, Any]]] = None,
    revenue_column: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Detects anomalies across time-series and individual numeric columns
    using IQR, Z-score, Isolation Forest, and Rolling Statistics.
    """
    anomalies: List[Dict[str, Any]] = []

    # 1. Time-series rolling anomaly detection
    if time_series and len(time_series) >= 4:
        metric_name = revenue_column if revenue_column else "volume"
        periods = [p["period"] for p in time_series]
        values = np.array([float(p["value"]) for p in time_series], dtype=float)

        window_size = min(3, len(values) - 1)
        for i in range(window_size, len(values)):
            history = values[max(0, i - 4):i]
            mean_val = float(np.mean(history))
            std_val = float(np.std(history)) if len(history) > 1 else 0.0
            observed = float(values[i])

            lower_bound = max(0.0, mean_val - 2.0 * max(std_val, mean_val * 0.15))
            upper_bound = mean_val + 2.0 * max(std_val, mean_val * 0.15)

            if observed < lower_bound or observed > upper_bound:
                diff = observed - mean_val
                deviation_pct = (diff / max(mean_val, 1e-6)) * 100.0
                abs_dev = abs(deviation_pct)
                severity = "high" if abs_dev >= 30.0 else ("medium" if abs_dev >= 15.0 else "low")

                formatted_obs = f"₹{observed:,.2f}" if revenue_column else f"{observed:,.0f}"
                formatted_range = f"{'₹' if revenue_column else ''}{lower_bound:,.2f} – {'₹' if revenue_column else ''}{upper_bound:,.2f}"

                anomaly_id = f"ts-{i}-{uuid.uuid4().hex[:6]}"
                anomalies.append({
                    "id": anomaly_id,
                    "title": f"Unusual {metric_name} in {periods[i]}",
                    "detail": f"Observed {formatted_obs} deviates by {deviation_pct:+.1f}% from expected range ({formatted_range}).",
                    "metric": metric_name,
                    "period": periods[i],
                    "observed": round(observed, 2),
                    "expected_range": [round(lower_bound, 2), round(upper_bound, 2)],
                    "deviation": f"{deviation_pct:+.1f}%",
                    "severity": severity,
                    "method": "Rolling Statistics (2σ)",
                    "source_columns": [date_column] + ([revenue_column] if revenue_column else []),
                    "explanation": f"The value in {periods[i]} represents a statistically significant shift from the prior {len(history)} periods baseline.",
                    "investigation_details": {
                        "prior_baseline_mean": round(mean_val, 2),
                        "prior_baseline_std": round(std_val, 2),
                        "z_score": round((observed - mean_val) / max(std_val, 1e-6), 2),
                        "neighboring_periods": [
                            {"period": periods[j], "value": round(float(values[j]), 2)}
                            for j in range(max(0, i - 2), min(len(values), i + 3))
                        ]
                    }
                })

    # 2. Individual column anomalies (IQR + Isolation Forest)
    numeric_cols = [
        c["name"]
        for c in schema
        if c["semantic_type"] in {"numeric", "currency", "percentage"} and c["name"] in frame.columns
    ]

    for col in numeric_cols[:5]:
        series = pd.to_numeric(frame[col], errors="coerce").dropna()
        if len(series) < 8 or series.nunique() < 4:
            continue

        q25 = float(series.quantile(0.25))
        q75 = float(series.quantile(0.75))
        iqr = q75 - q25
        if iqr <= 0:
            continue

        lower_bound = q25 - 1.5 * iqr
        upper_bound = q75 + 1.5 * iqr
        mean_val = float(series.mean())
        std_val = float(series.std()) if len(series) > 1 else 1.0

        # Run Isolation Forest if enough observations
        iso_outlier_indices = set()
        if len(series) >= 20:
            try:
                clf = IsolationForest(contamination=0.05, random_state=42)
                preds = clf.fit_predict(series.to_numpy().reshape(-1, 1))
                iso_outlier_indices = set(series.index[preds == -1])
            except Exception:
                pass

        # Identify extreme outlier points (top 3 most extreme)
        outlier_mask = (series < lower_bound) | (series > upper_bound)
        outlier_points = series[outlier_mask]

        if not outlier_points.empty:
            # Sort by distance from mean
            sorted_outliers = outlier_points.iloc[np.argsort(-np.abs(outlier_points.to_numpy() - mean_val))]
            for idx, val in sorted_outliers.head(2).items():
                val_float = float(val)
                z_score = (val_float - mean_val) / max(std_val, 1e-6)
                dev_pct = ((val_float - mean_val) / max(abs(mean_val), 1e-6)) * 100.0
                severity = "high" if abs(z_score) >= 3.0 or idx in iso_outlier_indices else "medium"

                orig_col = next((c.get("original_name", col) for c in schema if c["name"] == col), col)
                anomaly_id = f"col-{col}-{idx}-{uuid.uuid4().hex[:6]}"

                anomalies.append({
                    "id": anomaly_id,
                    "title": f"Extreme outlier in {orig_col}",
                    "detail": f"Row #{idx + 1} observed value {val_float:,.2f} is {dev_pct:+.1f}% from median ({q25 + iqr/2:,.2f}).",
                    "metric": orig_col,
                    "period": f"Row #{idx + 1}",
                    "observed": round(val_float, 2),
                    "expected_range": [round(lower_bound, 2), round(upper_bound, 2)],
                    "deviation": f"{dev_pct:+.1f}%",
                    "severity": severity,
                    "method": "Isolation Forest & IQR" if idx in iso_outlier_indices else "1.5× IQR",
                    "source_columns": [col],
                    "explanation": f"Value {val_float:,.2f} falls outside the [Q1 - 1.5×IQR, Q3 + 1.5×IQR] bounds ({lower_bound:,.2f} to {upper_bound:,.2f}). Z-score: {z_score:.2f}.",
                    "investigation_details": {
                        "row_index": int(idx),
                        "column": col,
                        "mean": round(mean_val, 2),
                        "median": round(q25 + iqr / 2, 2),
                        "std_dev": round(std_val, 2),
                        "z_score": round(z_score, 2),
                        "isolation_forest_flag": bool(idx in iso_outlier_indices)
                    }
                })

    return anomalies
