from __future__ import annotations
from itertools import combinations
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

DIMENSIONS = {"category", "status", "source", "region", "location", "delivery_mode", "person", "channel"}
NUMERIC = {"numeric", "currency", "percentage"}


def generate_visualizations(
    frame: pd.DataFrame,
    schema: list[dict],
    dimensions: list[dict],
    base_charts: list[dict],
    revenue_column: str | None = None,
) -> Tuple[list[dict], list[dict]]:
    charts = list(base_charts)
    correlations = []
    numeric_columns = [
        column["name"]
        for column in schema
        if column["semantic_type"] in NUMERIC and column["name"] in frame
    ]
    metric_columns = numeric_columns[:6]
    dimension_columns = [item["column"] for item in dimensions if item.get("unique_count", 0) <= 25 and item["column"] in frame]

    # 1. Histograms for numeric measures
    for column in metric_columns[:3]:
        values = pd.to_numeric(frame[column], errors="coerce").dropna()
        if len(values) < 2 or values.nunique() < 2:
            continue
        bin_count = min(20, max(5, int(np.ceil(np.log2(len(values)) + 1))))
        counts, edges = np.histogram(values.to_numpy(dtype=float), bins=bin_count)
        points = [
            {"label": f"{edges[i]:,.3g}–{edges[i + 1]:,.3g}", "value": int(count), "lower": float(edges[i]), "upper": float(edges[i+1])}
            for i, count in enumerate(counts)
        ]
        charts.append({
            "id": f"hist_{column}",
            "kind": "histogram",
            "title": f"Distribution of {column}",
            "x_key": "label",
            "y_key": "value",
            "y_label": "records",
            "data": points,
            "source_columns": [column],
            "width": 6
        })

    # 2. Scatter & Correlation
    pair_values = []
    for left, right in combinations(metric_columns, 2):
        pair = frame[[left, right]].apply(pd.to_numeric, errors="coerce").dropna()
        if len(pair) < 3 or pair[left].nunique() < 2 or pair[right].nunique() < 2:
            continue
        try:
            coefficient = float(pair[left].corr(pair[right]))
            if not np.isnan(coefficient):
                correlations.append({
                    "x": left,
                    "y": right,
                    "pearson": round(coefficient, 4),
                    "sample_size": int(len(pair))
                })
                pair_values.append((abs(coefficient), coefficient, left, right, pair))
        except Exception:
            continue

    for _, coefficient, left, right, pair in sorted(pair_values, reverse=True)[:3]:
        chart_sample = pair.sample(n=500, random_state=42) if len(pair) > 500 else pair
        charts.append({
            "id": f"scatter_{left}_{right}",
            "kind": "scatter",
            "title": f"{left} vs {right} (r={coefficient:.2f})",
            "x_key": "x",
            "y_key": "y",
            "x_label": left,
            "y_label": right,
            "data": [
                {"x": float(row[left]), "y": float(row[right])}
                for _, row in chart_sample.iterrows()
            ],
            "source_columns": [left, right],
            "sampled": len(pair) > 500,
            "width": 6
        })

    # 3. Pie/Donut charts for low-cardinality categories
    dimensions_by_column = {item["column"]: item for item in dimensions}
    pie_count = 0
    for column in schema:
        if column["semantic_type"] not in DIMENSIONS or column["unique_count"] < 2 or column["unique_count"] > 6:
            continue
        dimension = dimensions_by_column.get(column["name"])
        if dimension and pie_count < 2:
            charts.append({
                "id": f"pie_{column['name']}",
                "kind": "pie",
                "title": f"{column['original_name']} distribution",
                "data": dimension["values"],
                "source_columns": [column["name"]],
                "width": 6
            })
            pie_count += 1

    # 4. Dimension aggregations for non-revenue datasets
    if not revenue_column:
        measure_columns = [column for column in numeric_columns if column in frame][:2]
        for dimension in dimension_columns[:3]:
            for metric in measure_columns:
                try:
                    grouped = (
                        pd.to_numeric(frame[metric], errors="coerce")
                        .groupby(frame[dimension])
                        .mean()
                        .dropna()
                        .sort_values(ascending=False)
                        .head(10)
                    )
                    if len(grouped) < 2:
                        continue
                    charts.append({
                        "id": f"bar_{dimension}_{metric}",
                        "kind": "bar",
                        "title": f"Average {metric} by {dimension}",
                        "x_key": "label",
                        "y_key": "value",
                        "y_label": metric,
                        "data": [
                            {"label": str(label), "value": round(float(value), 3)}
                            for label, value in grouped.items()
                        ],
                        "source_columns": [dimension, metric],
                        "width": 6
                    })
                    break
                except Exception:
                    continue

    # 5. Advanced Power BI Visual Types: Treemap
    if dimension_columns:
        primary_dim = dimension_columns[0]
        primary_metric = revenue_column or (metric_columns[0] if metric_columns else None)
        try:
            if primary_metric:
                grouped_tm = (
                    pd.to_numeric(frame[primary_metric], errors="coerce")
                    .groupby(frame[primary_dim].astype(str))
                    .sum()
                    .dropna()
                    .sort_values(ascending=False)
                    .head(8)
                )
            else:
                grouped_tm = frame[primary_dim].astype(str).value_counts().head(8)

            total_tm = float(grouped_tm.sum()) or 1.0
            tm_data = [
                {
                    "name": str(k),
                    "value": round(float(v), 2),
                    "pct": round(float(v) / total_tm * 100, 1),
                    "formatted": f"{float(v):,.2f}"
                }
                for k, v in grouped_tm.items()
            ]
            if len(tm_data) >= 3:
                charts.append({
                    "id": f"treemap_{primary_dim}",
                    "kind": "treemap",
                    "title": f"{primary_dim.replace('_', ' ').title()} Share (Treemap)",
                    "data": tm_data,
                    "source_columns": [primary_dim] + ([primary_metric] if primary_metric else []),
                    "width": 6
                })
        except Exception:
            pass

    # 6. Advanced Power BI Visual Types: Stacked Bar / Stacked Column (if >= 2 dimensions)
    if len(dimension_columns) >= 2:
        dim1 = dimension_columns[0]
        dim2 = dimension_columns[1]
        val_metric = revenue_column or (metric_columns[0] if metric_columns else None)
        try:
            top_x = frame[dim1].astype(str).value_counts().head(6).index.tolist()
            top_y = frame[dim2].astype(str).value_counts().head(4).index.tolist()
            sub = frame[frame[dim1].astype(str).isin(top_x) & frame[dim2].astype(str).isin(top_y)]

            stacked_rows = []
            for x_val in top_x:
                row_item = {"label": x_val, "total": 0.0}
                for y_val in top_y:
                    match = sub[(sub[dim1].astype(str) == x_val) & (sub[dim2].astype(str) == y_val)]
                    if val_metric:
                        v = float(pd.to_numeric(match[val_metric], errors="coerce").dropna().sum())
                    else:
                        v = float(len(match))
                    row_item[y_val] = round(v, 2)
                    row_item["total"] += v
                row_item["total"] = round(row_item["total"], 2)
                stacked_rows.append(row_item)

            if len(stacked_rows) >= 2:
                charts.append({
                    "id": f"stacked_{dim1}_{dim2}",
                    "kind": "stacked_bar",
                    "title": f"{dim1.title()} by {dim2.title()} (Stacked)",
                    "x_key": "label",
                    "legend": dim2,
                    "series": top_y,
                    "data": stacked_rows,
                    "source_columns": [dim1, dim2] + ([val_metric] if val_metric else []),
                    "width": 6
                })
        except Exception:
            pass

    # 7. Advanced Power BI Visual Types: Combo Chart (Dual Measure: Bar + Line)
    if len(metric_columns) >= 2 and dimension_columns:
        m1 = revenue_column or metric_columns[0]
        m2 = metric_columns[1] if metric_columns[0] == m1 else metric_columns[0]
        dim = dimension_columns[0]
        try:
            combo_grouped = (
                frame.groupby(frame[dim].astype(str))
                .agg({
                    m1: lambda s: float(pd.to_numeric(s, errors="coerce").dropna().sum()),
                    m2: lambda s: float(pd.to_numeric(s, errors="coerce").dropna().mean())
                })
                .sort_values(by=m1, ascending=False)
                .head(8)
            )
            combo_data = [
                {
                    "label": str(k),
                    m1: round(float(row[m1]), 2),
                    m2: round(float(row[m2]), 2),
                }
                for k, row in combo_grouped.iterrows()
            ]
            if len(combo_data) >= 3:
                charts.append({
                    "id": f"combo_{m1}_{m2}",
                    "kind": "combo",
                    "title": f"{m1.title()} & Avg {m2.title()} by {dim.title()}",
                    "x_key": "label",
                    "primary_metric": m1,
                    "secondary_metric": m2,
                    "data": combo_data,
                    "source_columns": [dim, m1, m2],
                    "width": 6
                })
        except Exception:
            pass

    # 8. Advanced Power BI Visual Types: Heatmap Matrix (if >= 2 dimensions)
    if len(dimension_columns) >= 2:
        hx = dimension_columns[0]
        hy = dimension_columns[1]
        hm_metric = revenue_column or (metric_columns[0] if metric_columns else None)
        try:
            top_hx = frame[hx].astype(str).value_counts().head(6).index.tolist()
            top_hy = frame[hy].astype(str).value_counts().head(5).index.tolist()
            sub_h = frame[frame[hx].astype(str).isin(top_hx) & frame[hy].astype(str).isin(top_hy)]

            matrix = []
            raw_vals = []
            for x_v in top_hx:
                for y_v in top_hy:
                    m = sub_h[(sub_h[hx].astype(str) == x_v) & (sub_h[hy].astype(str) == y_v)]
                    if hm_metric:
                        v = float(pd.to_numeric(m[hm_metric], errors="coerce").dropna().sum())
                    else:
                        v = float(len(m))
                    raw_vals.append(v)
                    matrix.append({"x": x_v, "y": y_v, "value": round(v, 2)})

            max_v = max(raw_vals) if raw_vals else 1.0
            min_v = min(raw_vals) if raw_vals else 0.0
            range_v = (max_v - min_v) if (max_v - min_v) > 0 else 1.0

            for cell in matrix:
                cell["intensity"] = round((cell["value"] - min_v) / range_v, 3)

            if len(matrix) >= 4:
                charts.append({
                    "id": f"heatmap_{hx}_{hy}",
                    "kind": "heatmap",
                    "title": f"{hx.title()} vs {hy.title()} Heatmap Matrix",
                    "x_categories": top_hx,
                    "y_categories": top_hy,
                    "data": matrix,
                    "min_val": round(min_v, 2),
                    "max_val": round(max_v, 2),
                    "source_columns": [hx, hy] + ([hm_metric] if hm_metric else []),
                    "width": 6
                })
        except Exception:
            pass

    # 9. Advanced Power BI Visual Types: Box Plot
    if metric_columns:
        box_m = metric_columns[0]
        box_dim = dimension_columns[0] if dimension_columns else None
        try:
            box_results = []
            if box_dim:
                top_b_cats = frame[box_dim].astype(str).value_counts().head(5).index
                for cat in top_b_cats:
                    vals = pd.to_numeric(frame[frame[box_dim].astype(str) == cat][box_m], errors="coerce").dropna().sort_values()
                    if len(vals) >= 4:
                        q1 = float(vals.quantile(0.25))
                        med = float(vals.median())
                        q3 = float(vals.quantile(0.75))
                        iqr = q3 - q1
                        box_results.append({
                            "category": str(cat),
                            "min": round(max(float(vals.min()), q1 - 1.5 * iqr), 2),
                            "q1": round(q1, 2),
                            "median": round(med, 2),
                            "q3": round(q3, 2),
                            "max": round(min(float(vals.max()), q3 + 1.5 * iqr), 2),
                            "outliers": [round(float(v), 2) for v in vals[(vals < q1 - 1.5 * iqr) | (vals > q3 + 1.5 * iqr)].head(10)],
                            "count": len(vals)
                        })
            if len(box_results) >= 2:
                charts.append({
                    "id": f"box_{box_m}",
                    "kind": "box_plot",
                    "title": f"{box_m.title()} Quartiles & Outliers (Box Plot)",
                    "metric": box_m,
                    "data": box_results,
                    "source_columns": ([box_dim] if box_dim else []) + [box_m],
                    "width": 6
                })
        except Exception:
            pass

    # 10. Advanced Power BI Visual Types: Funnel Chart
    if dimension_columns:
        funnel_dim = dimension_columns[0]
        funnel_m = revenue_column or (metric_columns[0] if metric_columns else None)
        try:
            if funnel_m:
                f_grouped = (
                    pd.to_numeric(frame[funnel_m], errors="coerce")
                    .groupby(frame[funnel_dim].astype(str))
                    .sum()
                    .dropna()
                    .sort_values(ascending=False)
                    .head(5)
                )
            else:
                f_grouped = frame[funnel_dim].astype(str).value_counts().head(5)

            stages = [{"stage": str(k), "value": round(float(v), 2)} for k, v in f_grouped.items()]
            if len(stages) >= 3:
                top_v = stages[0]["value"] or 1.0
                prev_v = top_v
                for s in stages:
                    s["pct_of_first"] = round((s["value"] / top_v) * 100, 1)
                    s["pct_of_prev"] = round((s["value"] / prev_v) * 100, 1) if prev_v > 0 else 100.0
                    prev_v = s["value"]

                charts.append({
                    "id": f"funnel_{funnel_dim}",
                    "kind": "funnel",
                    "title": f"{funnel_dim.title()} Funnel Flow",
                    "data": stages,
                    "source_columns": [funnel_dim] + ([funnel_m] if funnel_m else []),
                    "width": 6
                })
        except Exception:
            pass

    # 11. Advanced Power BI Visual Types: Gauge
    if metric_columns:
        gauge_m = revenue_column or metric_columns[0]
        try:
            num_g = pd.to_numeric(frame[gauge_m], errors="coerce").dropna()
            if len(num_g) > 0:
                current_sum = float(num_g.sum())
                target_sum = round(current_sum * 1.15, 2)
                max_g = round(current_sum * 1.3, 2)
                pct_g = round(current_sum / target_sum * 100, 1) if target_sum > 0 else 100.0
                charts.append({
                    "id": f"gauge_{gauge_m}",
                    "kind": "gauge",
                    "title": f"{gauge_m.title()} Target Progress (Gauge)",
                    "value": round(current_sum, 2),
                    "target": target_sum,
                    "min": 0,
                    "max": max_g,
                    "pct": min(100.0, pct_g),
                    "source_columns": [gauge_m],
                    "width": 6
                })
        except Exception:
            pass

    return charts, correlations
