from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd


def generate_insights(
    frame: pd.DataFrame,
    schema: List[Dict[str, Any]],
    dimensions: List[Dict[str, Any]],
    quality: Dict[str, Any],
    correlations: List[Dict[str, Any]],
    time_series: List[Dict[str, Any]],
    revenue_column: Optional[str] = None,
    revenue_sources: Optional[List[str]] = None,
    date_column: Optional[str] = None,
    numeric_stats: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    insights: List[Dict[str, Any]] = []
    rev_sources = revenue_sources or ([revenue_column] if revenue_column else [])

    # 1. Dimension insights (Highest & Lowest category)
    for dim in dimensions:
        col = dim["column"]
        if not dim.get("values"):
            continue
        if revenue_column and revenue_column in frame.columns:
            try:
                grouped = (
                    frame.groupby(col, dropna=True)[revenue_column]
                    .sum()
                    .sort_values(ascending=False)
                )
                if not grouped.empty:
                    top_label, top_val = grouped.index[0], float(grouped.iloc[0])
                    insights.append({
                        "title": f"Highest {dim.get('semantic_type', 'category')} by revenue",
                        "text": f"{top_label} generated the highest recorded revenue (₹{top_val:,.2f}).",
                        "source_columns": [col] + rev_sources,
                        "calculation": f"SUM({revenue_column}) GROUP BY {col} ORDER BY sum DESC LIMIT 1",
                        "metric": revenue_column,
                        "result": f"₹{top_val:,.2f}"
                    })
                    if len(grouped) > 2:
                        low_label, low_val = grouped.index[-1], float(grouped.iloc[-1])
                        insights.append({
                            "title": f"Lowest {dim.get('semantic_type', 'category')} by revenue",
                            "text": f"{low_label} generated the lowest recorded revenue (₹{low_val:,.2f}).",
                            "source_columns": [col] + rev_sources,
                            "calculation": f"SUM({revenue_column}) GROUP BY {col} ORDER BY sum ASC LIMIT 1",
                            "metric": revenue_column,
                            "result": f"₹{low_val:,.2f}"
                        })
            except Exception:
                pass
        else:
            # Volume based
            vals = dim["values"]
            if vals:
                top = vals[0]
                total_records = len(frame)
                pct = round(top["value"] / max(total_records, 1) * 100, 1)
                insights.append({
                    "title": f"Top {dim.get('semantic_type', 'dimension')}",
                    "text": f"{top['label']} accounts for the largest share of records with {top['value']:,} entries ({pct}%).",
                    "source_columns": [col],
                    "calculation": f"COUNT(records) GROUP BY {col} ORDER BY count DESC LIMIT 1",
                    "metric": "record_count",
                    "result": f"{top['value']:,} ({pct}%)"
                })

    # 2. Time-series insights (Growth, Decline, Coverage)
    if date_column and time_series:
        insights.append({
            "title": "Time coverage",
            "text": f"Dataset records span {time_series[0]['period']} through {time_series[-1]['period']}.",
            "source_columns": [date_column],
            "calculation": f"MIN({date_column}) to MAX({date_column})",
            "metric": "date_span",
            "result": f"{time_series[0]['period']} – {time_series[-1]['period']}"
        })

        if len(time_series) > 1 and time_series[-2].get("value"):
            latest = float(time_series[-1]["value"])
            prev = float(time_series[-2]["value"])
            if prev > 0:
                growth_rate = ((latest / prev) - 1) * 100
                direction = "increased" if growth_rate >= 0 else "decreased"
                metric_name = revenue_column if revenue_column else "volume"
                insights.append({
                    "title": f"Recent period {direction}",
                    "text": f"{metric_name.replace('_', ' ').title()} {direction} {abs(growth_rate):.1f}% in the latest period.",
                    "source_columns": [date_column] + rev_sources,
                    "calculation": f"(latest_period ({latest:,.1f}) / previous_period ({prev:,.1f}) - 1) × 100",
                    "metric": f"{metric_name}_growth",
                    "result": f"{growth_rate:+.1f}%"
                })

        # Multi-period trend change
        if len(time_series) >= 4:
            first_half = np.mean([p["value"] for p in time_series[:len(time_series)//2]])
            second_half = np.mean([p["value"] for p in time_series[len(time_series)//2:]])
            if first_half > 0:
                overall_growth = ((second_half / first_half) - 1) * 100
                if abs(overall_growth) >= 10:
                    trend_dir = "growth" if overall_growth > 0 else "decline"
                    insights.append({
                        "title": f"Macro trend {trend_dir}",
                        "text": f"The latter half of the recorded timeframe shows an average {abs(overall_growth):.1f}% {trend_dir} compared to the earlier baseline.",
                        "source_columns": [date_column] + rev_sources,
                        "calculation": f"(AVG(second_half) / AVG(first_half) - 1) × 100",
                        "metric": "trend_velocity",
                        "result": f"{overall_growth:+.1f}%"
                    })

    # 3. Correlation insights
    for corr in correlations:
        if abs(corr["pearson"]) >= 0.7:
            direction = "positive" if corr["pearson"] > 0 else "negative"
            insights.append({
                "title": "Strong numeric relationship",
                "text": f"{corr['x']} and {corr['y']} have a {direction} correlation of {corr['pearson']:.2f}.",
                "source_columns": [corr["x"], corr["y"]],
                "calculation": f"Pearson correlation, n={corr['sample_size']}",
                "metric": "pearson_r",
                "result": f"r = {corr['pearson']:.2f}"
            })

    # 4. Concentration Risk
    for dim in dimensions:
        col = dim["column"]
        vals = dim.get("values", [])
        if vals and len(frame) > 0:
            top_val = vals[0]["value"]
            pct = (top_val / len(frame)) * 100
            if pct >= 80:
                insights.append({
                    "title": f"Concentration risk in {col}",
                    "text": f"'{vals[0]['label']}' dominates {col} with {pct:.1f}% of all records.",
                    "source_columns": [col],
                    "calculation": f"COUNT({col}='{vals[0]['label']}') / COUNT(total_rows) × 100",
                    "metric": "concentration_percentage",
                    "result": f"{pct:.1f}%"
                })

    # 5. Data Quality and Missingness
    if quality.get("missing_values", 0) > 0:
        missing_pct = round(100.0 * quality["missing_values"] / max(quality["rows"] * quality["columns"], 1), 2)
        if missing_pct >= 2.0:
            insights.append({
                "title": "Data quality notification",
                "text": f"{missing_pct}% of cells contain missing values across {len(quality.get('missing_by_column', []))} columns.",
                "source_columns": [item["column"] for item in quality.get("missing_by_column", [])[:4]],
                "calculation": "COUNT(null cells) / (COUNT(rows) × COUNT(columns)) × 100",
                "metric": "null_rate",
                "result": f"{missing_pct}%"
            })

    # 6. Distribution Skewness for numeric columns
    if numeric_stats:
        for st in numeric_stats:
            if st.get("outlier_count", 0) > 0:
                outlier_pct = round(100.0 * st["outlier_count"] / max(st["count"], 1), 1)
                if outlier_pct >= 3.0:
                    insights.append({
                        "title": f"High outlier presence in {st['column']}",
                        "text": f"{st['outlier_count']} records ({outlier_pct}%) in {st['column']} fall beyond 1.5×IQR boundary.",
                        "source_columns": [st["column"]],
                        "calculation": f"COUNT(x < Q1 - 1.5×IQR OR x > Q3 + 1.5×IQR) / COUNT({st['column']}) × 100",
                        "metric": "outlier_frequency",
                        "result": f"{st['outlier_count']} ({outlier_pct}%)"
                    })

    return insights
