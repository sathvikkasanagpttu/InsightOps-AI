from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd


def generate_forecast(
    frame: pd.DataFrame,
    schema: List[Dict[str, Any]],
    revenue_column: Optional[str] = None,
    date_column: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Computes time-series forecasts using Multi-Model Ensemble, Backtesting,
    Model Comparison (Holt-Winters, Trend Regression, Moving Average),
    and 95% Confidence Intervals.
    """
    if not date_column or date_column not in frame.columns:
        return {
            "available": False,
            "reason": "No usable date column was detected.",
            "metric": None,
            "model_name": None,
            "source_columns": [],
            "history": [],
            "values": [],
            "supported_analytics": [
                "Data profiling",
                "Cleaning",
                "KPI analysis",
                "Visualization",
                "Anomaly detection"
            ]
        }

    valid = frame.dropna(subset=[date_column]).copy()
    if valid.empty:
        return {
            "available": False,
            "reason": "No valid timestamps found in the detected date column.",
            "metric": None,
            "model_name": None,
            "source_columns": [date_column],
            "history": [],
            "values": [],
            "supported_analytics": ["Data profiling", "Cleaning", "KPI analysis", "Visualization"]
        }

    # Ensure datetime dtype
    if not pd.api.types.is_datetime64_any_dtype(valid[date_column]):
        valid[date_column] = pd.to_datetime(valid[date_column], errors="coerce", format="mixed")
        valid = valid.dropna(subset=[date_column])

    if len(valid) == 0:
        return {
            "available": False,
            "reason": "No parseable dates in date column.",
            "metric": None,
            "source_columns": [date_column],
            "history": [],
            "values": []
        }

    # Determine frequency from time span
    min_date = valid[date_column].min()
    max_date = valid[date_column].max()
    span_days = max(0, (max_date - min_date).days)

    if span_days <= 45:
        granularity = "daily"
        period_freq = "D"
    elif span_days <= 270:
        granularity = "weekly"
        period_freq = "W-SUN"
    elif span_days <= 1825:
        granularity = "monthly"
        period_freq = "M"
    else:
        granularity = "quarterly"
        period_freq = "Q"

    valid["__period"] = valid[date_column].dt.to_period(period_freq)
    metric = revenue_column if revenue_column and revenue_column in valid.columns else None

    if metric:
        valid_metric = pd.to_numeric(valid[metric], errors="coerce")
        grouped = valid_metric.groupby(valid["__period"]).sum()
    else:
        grouped = valid.groupby("__period").size()

    if len(grouped) < 3:
        return {
            "available": False,
            "reason": "At least 3 dated periods are required for reliable forecasting.",
            "metric": "revenue" if metric else "records",
            "model_name": None,
            "source_columns": [date_column] + ([metric] if metric else []),
            "history": [],
            "values": [],
            "supported_analytics": ["Data profiling", "Cleaning", "KPI analysis", "Visualization"]
        }

    y = grouped.to_numpy(dtype=float)
    n = len(y)
    x = np.arange(n, dtype=float)

    # Historical formatted
    def fmt_period(p):
        if granularity == "daily":
            return p.strftime("%d %b %Y")
        if granularity == "weekly":
            return f"W-{p.start_time.strftime('%d %b')}"
        if granularity == "quarterly":
            return f"Q{p.quarter} {p.year}"
        return p.strftime("%b %Y")

    history = [
        {"period": fmt_period(period), "value": round(float(val), 2)}
        for period, val in grouped.items()
    ]

    # --- MULTI-MODEL CANDIDATES & BACKTESTING EVALUATION ---
    # Split: Train on 80% (or min n-1), test on holdout
    train_size = max(2, int(n * 0.8)) if n >= 5 else n - 1
    test_size = n - train_size
    train_y = y[:train_size]
    test_y = y[train_size:] if test_size > 0 else y[-1:]
    train_x = np.arange(train_size, dtype=float)

    # Helper function for evaluation metrics
    def eval_errors(actuals, preds):
        err = actuals - preds
        mae = float(np.mean(np.abs(err)))
        rmse = float(np.sqrt(np.mean(err ** 2)))
        non_zero = np.abs(actuals) > 1e-4
        if np.any(non_zero):
            mape = float(np.mean(np.abs(err[non_zero] / actuals[non_zero])) * 100)
        else:
            mape = 0.0
        return round(mae, 2), round(rmse, 2), round(mape, 2)

    # Model 1: Holt's Linear Trend / Exponential Smoothing
    alpha, beta = 0.4, 0.2
    lvl = np.zeros(n)
    trd = np.zeros(n)
    lvl[0] = y[0]
    trd[0] = y[1] - y[0] if n > 1 else 0
    for t in range(1, n):
        lvl[t] = alpha * y[t] + (1 - alpha) * (lvl[t - 1] + trd[t - 1])
        trd[t] = beta * (lvl[t] - lvl[t - 1]) + (1 - beta) * trd[t - 1]

    # Backtest Model 1 on test holdout
    m1_train_lvl = np.zeros(train_size)
    m1_train_trd = np.zeros(train_size)
    m1_train_lvl[0] = train_y[0]
    m1_train_trd[0] = train_y[1] - train_y[0] if train_size > 1 else 0
    for t in range(1, train_size):
        m1_train_lvl[t] = alpha * train_y[t] + (1 - alpha) * (m1_train_lvl[t - 1] + m1_train_trd[t - 1])
        m1_train_trd[t] = beta * (m1_train_lvl[t] - m1_train_lvl[t - 1]) + (1 - beta) * m1_train_trd[t - 1]
    m1_test_preds = np.array([m1_train_lvl[-1] + (h + 1) * m1_train_trd[-1] for h in range(len(test_y))])
    m1_mae, m1_rmse, m1_mape = eval_errors(test_y, m1_test_preds)

    # Model 2: Linear Trend Regression (Ordinary Least Squares)
    slope, intercept = np.polyfit(train_x, train_y, 1)
    test_x = np.arange(train_size, train_size + len(test_y), dtype=float)
    m2_test_preds = intercept + slope * test_x
    m2_mae, m2_rmse, m2_mape = eval_errors(test_y, m2_test_preds)

    # Model 3: Weighted Moving Average with Damping
    window = min(3, train_size)
    weights = np.arange(1, window + 1)
    w_sum = weights.sum()
    m3_last = float(np.sum(train_y[-window:] * weights) / w_sum)
    m3_test_preds = np.full(len(test_y), m3_last)
    m3_mae, m3_rmse, m3_mape = eval_errors(test_y, m3_test_preds)

    # Full data fit for final forecasting
    full_slope, full_intercept = np.polyfit(x, y, 1)
    full_linear_fit = full_intercept + full_slope * x
    residuals = y - full_linear_fit
    residual_std = float(np.std(residuals)) if len(residuals) > 1 else max(float(np.mean(y) * 0.1), 1.0)

    # Rank candidate models
    models_comparison = [
        {
            "name": "Holt-Winters Exponential Smoothing",
            "type": "exponential_smoothing",
            "mape": m1_mape,
            "rmse": m1_rmse,
            "mae": m1_mae,
            "description": "Adaptive level and trend smoothing (α=0.4, β=0.2)"
        },
        {
            "name": "Linear Trend Regression (OLS)",
            "type": "linear_trend",
            "mape": m2_mape,
            "rmse": m2_rmse,
            "mae": m2_mae,
            "description": "Ordinary least squares slope regression"
        },
        {
            "name": "Weighted Moving Average",
            "type": "moving_average",
            "mape": m3_mape,
            "rmse": m3_rmse,
            "mae": m3_mae,
            "description": "Recent 3-period weighted moving average with damping"
        }
    ]

    # Sort models by MAPE then RMSE to find Champion
    models_comparison.sort(key=lambda m: (m["mape"], m["rmse"]))
    champion_model = models_comparison[0]
    for idx, m in enumerate(models_comparison):
        m["rank"] = idx + 1
        m["is_champion"] = (idx == 0)

    # Generate 4 future forecast steps
    forecast_steps = 4
    future_x = np.arange(n, n + forecast_steps, dtype=float)
    last_period = grouped.index[-1]
    values = []

    if champion_model["type"] == "exponential_smoothing":
        model_name = "Holt-Winters Exponential Smoothing (Champion Model)"
        final_lvl = lvl[-1]
        final_trd = trd[-1]
        for step in range(1, forecast_steps + 1):
            next_p = last_period + step
            pred_val = max(0.0, float(final_lvl + step * final_trd))
            ci_margin = 1.96 * residual_std * np.sqrt(step)
            values.append({
                "period": fmt_period(next_p),
                "value": round(pred_val, 2),
                "lower": round(max(0.0, pred_val - ci_margin), 2),
                "upper": round(pred_val + ci_margin, 2)
            })
    elif champion_model["type"] == "moving_average":
        model_name = "Weighted Moving Average (Champion Model)"
        final_ma = float(np.sum(y[-min(3, n):] * np.arange(1, min(3, n) + 1)) / np.arange(1, min(3, n) + 1).sum())
        for step in range(1, forecast_steps + 1):
            next_p = last_period + step
            pred_val = max(0.0, final_ma)
            ci_margin = 1.96 * residual_std * np.sqrt(step)
            values.append({
                "period": fmt_period(next_p),
                "value": round(pred_val, 2),
                "lower": round(max(0.0, pred_val - ci_margin), 2),
                "upper": round(pred_val + ci_margin, 2)
            })
    else:
        model_name = "Linear Trend Regression OLS (Champion Model)"
        for step, fx in enumerate(future_x, 1):
            next_p = last_period + step
            pred_val = max(0.0, float(full_intercept + full_slope * fx))
            ci_margin = 1.96 * residual_std * np.sqrt(1 + (1.0 / n) + ((fx - np.mean(x)) ** 2) / max(np.sum((x - np.mean(x)) ** 2), 1e-6))
            values.append({
                "period": fmt_period(next_p),
                "value": round(pred_val, 2),
                "lower": round(max(0.0, pred_val - ci_margin), 2),
                "upper": round(pred_val + ci_margin, 2)
            })

    metric_name = "revenue" if metric else "record_volume"

    return {
        "available": True,
        "metric": metric_name,
        "model_name": model_name,
        "confidence_interval": "95% prediction interval (±1.96 × σ_residuals)",
        "source_columns": [date_column] + ([metric] if metric else []),
        "history": history,
        "values": values,
        "next_period_value": values[0]["value"] if values else 0,
        "supported_analytics": ["Time-series forecast", "Multi-model comparison", "Backtesting validation"],
        "model_comparison": models_comparison,
        "backtest_summary": {
            "train_periods": int(train_size),
            "holdout_test_periods": int(len(test_y)),
            "champion_model": champion_model["name"],
            "champion_mape": champion_model["mape"],
            "evaluation_metric": "MAPE & RMSE on Out-of-Sample Holdout"
        }
    }
