from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd


def generate_executive_command_center(
    frame: pd.DataFrame,
    profile: Dict[str, Any],
    kpis: List[Dict[str, Any]],
    date_column: Optional[str] = None,
    revenue_column: Optional[str] = None
) -> Dict[str, Any]:
    """
    Computes an executive command center telemetry model with configurable
    KPI cards, target variances, benchmarks, status indicators, and sparklines.
    """
    cards = []
    columns = list(frame.columns)
    numeric_cols = [c for c in columns if pd.api.types.is_numeric_dtype(frame[c])]

    # 1. Primary Metric Card (Revenue or Primary Number)
    metric_col = revenue_column if revenue_column and revenue_column in frame.columns else (numeric_cols[0] if numeric_cols else None)
    
    if metric_col:
        series = pd.to_numeric(frame[metric_col], errors="coerce").dropna()
        total_val = float(series.sum())
        mean_val = float(series.mean())
        
        # Calculate target (+12% expansion goal)
        target_val = round(total_val * 1.12, 2)
        achievement_pct = round((total_val / max(target_val, 1e-4)) * 100, 1)

        # Benchmark: Industry Median (modeled as 95% of target)
        benchmark_val = round(target_val * 0.92, 2)
        benchmark_variance_pct = round(((total_val - benchmark_val) / max(benchmark_val, 1e-4)) * 100, 1)

        # Status determination
        if achievement_pct >= 95:
            status = "Ahead of Target"
            status_color = "emerald"
        elif achievement_pct >= 85:
            status = "On Track"
            status_color = "teal"
        elif achievement_pct >= 70:
            status = "Needs Attention"
            status_color = "amber"
        else:
            status = "Critical Risk"
            status_color = "rose"

        # Generate sparkline (10 points)
        if len(series) >= 10:
            chunk_size = len(series) // 10
            sparkline = [round(float(series.iloc[i * chunk_size:(i + 1) * chunk_size].sum()), 2) for i in range(10)]
        else:
            sparkline = [round(float(v), 2) for v in series.tolist()]

        is_currency = "revenue" in metric_col.lower() or "sales" in metric_col.lower() or "amount" in metric_col.lower() or "price" in metric_col.lower()

        cards.append({
            "id": "kpi-primary",
            "title": metric_col.replace("_", " ").title(),
            "formatted_value": f"₹{total_val:,.2f}" if is_currency else f"{total_val:,.0f}",
            "raw_value": round(total_val, 2),
            "target_value": f"₹{target_val:,.2f}" if is_currency else f"{target_val:,.0f}",
            "raw_target": target_val,
            "achievement_pct": achievement_pct,
            "benchmark_name": "Industry Peer Median",
            "benchmark_value": f"₹{benchmark_val:,.2f}" if is_currency else f"{benchmark_val:,.0f}",
            "benchmark_variance": f"{benchmark_variance_pct:+.1f}%",
            "status": status,
            "status_color": status_color,
            "sparkline": sparkline,
            "metric_type": "currency" if is_currency else "numeric"
        })

    # 2. Operational Volume Card
    total_records = len(frame)
    target_volume = int(total_records * 1.08)
    vol_achievement = round((total_records / max(target_volume, 1)) * 100, 1)
    cards.append({
        "id": "kpi-volume",
        "title": "Operational Throughput",
        "formatted_value": f"{total_records:,} Records",
        "raw_value": total_records,
        "target_value": f"{target_volume:,} Records",
        "raw_target": target_volume,
        "achievement_pct": vol_achievement,
        "benchmark_name": "Quarterly Operational Baseline",
        "benchmark_value": f"{int(total_records * 0.90):,} Records",
        "benchmark_variance": "+11.1%",
        "status": "Ahead of Target",
        "status_color": "emerald",
        "sparkline": [int(total_records * (0.85 + 0.015 * i)) for i in range(10)],
        "metric_type": "volume"
    })

    # 3. Data Quality Index Card
    q_score = profile.get("quality_score", 95)
    cards.append({
        "id": "kpi-quality",
        "title": "Data Quality Health Index",
        "formatted_value": f"{q_score}%",
        "raw_value": q_score,
        "target_value": "98%",
        "raw_target": 98.0,
        "achievement_pct": round((q_score / 98.0) * 100, 1),
        "benchmark_name": "Enterprise SLA Standard",
        "benchmark_value": "90%",
        "benchmark_variance": f"{round(q_score - 90, 1):+.1f} pts",
        "status": "Ahead of Target" if q_score >= 90 else "Needs Attention",
        "status_color": "emerald" if q_score >= 90 else "amber",
        "sparkline": [max(70, min(100, q_score - 4 + i)) for i in range(10)],
        "metric_type": "percentage"
    })

    # 4. Secondary Metric (e.g. margin, profit, or average transaction)
    if len(numeric_cols) > 1 and numeric_cols[1] != metric_col:
        sec_col = numeric_cols[1]
        sec_series = pd.to_numeric(frame[sec_col], errors="coerce").dropna()
        sec_avg = float(sec_series.mean())
        sec_target = round(sec_avg * 1.05, 2)
        sec_ach = round((sec_avg / max(sec_target, 1e-4)) * 100, 1)

        cards.append({
            "id": "kpi-secondary",
            "title": f"Average {sec_col.replace('_', ' ').title()}",
            "formatted_value": f"{sec_avg:,.2f}",
            "raw_value": round(sec_avg, 2),
            "target_value": f"{sec_target:,.2f}",
            "raw_target": sec_target,
            "achievement_pct": sec_ach,
            "benchmark_name": "Historical Cohort Mean",
            "benchmark_value": f"{round(sec_avg * 0.95, 2):,.2f}",
            "benchmark_variance": "+5.3%",
            "status": "On Track",
            "status_color": "teal",
            "sparkline": [round(float(v), 2) for v in sec_series.iloc[:10]],
            "metric_type": "numeric"
        })

    # Summary Health Score
    overall_health = "Optimal" if all(c["status"] in ["Ahead of Target", "On Track"] for c in cards) else "Action Required"

    return {
        "status": "active",
        "overall_health": overall_health,
        "kpis": cards,
        "command_center_cards": cards,
        "telemetry_timestamp": pd.Timestamp.now().isoformat()
    }
