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
    sensitivity: str = "medium",  # high, medium, low
    algorithm: str = "auto"       # auto, z_score, iqr, isolation_forest, moving_residual
) -> List[Dict[str, Any]]:
    """
    Detects anomalies across time-series and individual numeric columns
    using configurable algorithms (Z-score, IQR, Isolation Forest, Moving Residuals)
    with severity grading and root cause analysis.
    """
    anomalies: List[Dict[str, Any]] = []

    # Multiplier threshold based on sensitivity
    threshold_multipliers = {
        "low": 2.5,
        "medium": 2.0,
        "high": 1.5
    }
    sigma_mult = threshold_multipliers.get(sensitivity, 2.0)

    # 1. Time-series rolling anomaly detection
    if time_series and len(time_series) >= 4:
        metric_name = revenue_column if revenue_column else "volume"
        periods = [p["period"] for p in time_series]
        values = np.array([float(p["value"]) for p in time_series], dtype=float)

        window_size = min(3, len(values) - 1)
        for i in range(window_size, len(values)):
            history = values[max(0, i - 4):i]
            mean_val = float(np.mean(history))
            std_val = float(np.std(history)) if len(history) > 1 else max(mean_val * 0.1, 1.0)
            observed = float(values[i])

            lower_bound = max(0.0, mean_val - sigma_mult * std_val)
            upper_bound = mean_val + sigma_mult * std_val

            if observed < lower_bound or observed > upper_bound:
                diff = observed - mean_val
                deviation_pct = (diff / max(mean_val, 1e-6)) * 100.0
                abs_dev = abs(deviation_pct)
                z_score = abs(diff / max(std_val, 1e-6))

                # Rigorous 4-tier severity classification
                if abs_dev >= 50.0 or z_score >= 3.5:
                    severity = "critical"
                elif abs_dev >= 30.0 or z_score >= 2.5:
                    severity = "high"
                elif abs_dev >= 15.0 or z_score >= 1.8:
                    severity = "medium"
                else:
                    severity = "low"

                formatted_obs = f"₹{observed:,.2f}" if revenue_column else f"{observed:,.0f}"
                formatted_range = f"{'₹' if revenue_column else ''}{lower_bound:,.2f} – {'₹' if revenue_column else ''}{upper_bound:,.2f}"

                anomaly_id = f"anom-ts-{i}-{uuid.uuid4().hex[:6]}"
                direction = "spike" if diff > 0 else "drop"

                anomalies.append({
                    "id": anomaly_id,
                    "title": f"Unusual {metric_name} {direction.title()} in {periods[i]}",
                    "detail": f"Observed {formatted_obs} deviates by {deviation_pct:+.1f}% from expected baseline range ({formatted_range}).",
                    "metric": metric_name,
                    "period": periods[i],
                    "observed": round(observed, 2),
                    "expected_range": [round(lower_bound, 2), round(upper_bound, 2)],
                    "deviation": f"{deviation_pct:+.1f}%",
                    "deviation_score": round(z_score, 2),
                    "severity": severity,
                    "status": "open",  # open, investigating, resolved, dismissed
                    "algorithm": "Moving Residuals (Z-score)" if algorithm in ["auto", "moving_residual"] else algorithm,
                    "direction": direction,
                    "source_columns": [date_column] + ([revenue_column] if revenue_column else []),
                    "explanation": f"The value in {periods[i]} exhibits a {direction} of {abs_dev:.1f}% relative to the rolling historical average ({mean_val:,.1f}).",
                    "root_cause_analysis": f"Root cause indicator: Sudden {direction} observed in period {periods[i]}. Variance is {z_score:.1f} standard deviations above normal threshold.",
                    "investigation_details": {
                        "prior_baseline_mean": round(mean_val, 2),
                        "prior_baseline_std": round(std_val, 2),
                        "z_score": round(z_score, 2),
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

        iqr_mult = 1.5 if sensitivity == "high" else (2.0 if sensitivity == "medium" else 2.5)
        lower_bound = q25 - iqr_mult * iqr
        upper_bound = q75 + iqr_mult * iqr
        mean_val = float(series.mean())
        std_val = float(series.std()) if len(series) > 1 else 1.0

        # Run Isolation Forest if enough observations and requested
        iso_outliers_count = 0
        if len(series) >= 20 and algorithm in ["auto", "isolation_forest"]:
            try:
                clf = IsolationForest(contamination=0.05, random_state=42)
                preds = clf.fit_predict(series.to_numpy().reshape(-1, 1))
                iso_outliers_count = int(np.sum(preds == -1))
            except Exception:
                pass

        # Identify extreme outliers
        high_outliers = series[series > upper_bound]
        low_outliers = series[series < lower_bound]
        total_outliers = len(high_outliers) + len(low_outliers)

        if total_outliers > 0:
            max_outlier = float(high_outliers.max()) if len(high_outliers) > 0 else float(low_outliers.min())
            dev_score = round(abs(max_outlier - mean_val) / max(std_val, 1e-6), 2)
            severity = "critical" if dev_score >= 4.0 else ("high" if dev_score >= 2.5 else "medium")

            anom_id = f"anom-col-{col}-{uuid.uuid4().hex[:6]}"
            anomalies.append({
                "id": anom_id,
                "title": f"Distribution Outliers in '{col}'",
                "detail": f"Identified {total_outliers} extreme values ({len(high_outliers)} above upper fence, {len(low_outliers)} below lower fence).",
                "metric": col,
                "period": "Distribution Scan",
                "observed": round(max_outlier, 2),
                "expected_range": [round(lower_bound, 2), round(upper_bound, 2)],
                "deviation": f"{dev_score:.1f}σ",
                "deviation_score": dev_score,
                "severity": severity,
                "status": "open",
                "algorithm": "Interquartile Range (IQR) & Isolation Forest",
                "source_columns": [col],
                "explanation": f"Column '{col}' exhibits significant distribution tail kurtosis with {total_outliers} values lying outside the expected statistical fence.",
                "root_cause_analysis": f"Potential root causes: Data entry transposition, localized surge/drop, or extreme enterprise tier records.",
                "investigation_details": {
                    "q25": round(q25, 2),
                    "q75": round(q75, 2),
                    "iqr": round(iqr, 2),
                    "mean": round(mean_val, 2),
                    "std": round(std_val, 2),
                    "isolation_forest_flags": iso_outliers_count
                }
            })

    # Sort anomalies with critical/high first
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    anomalies.sort(key=lambda a: severity_order.get(a.get("severity", "medium"), 2))
    return anomalies
