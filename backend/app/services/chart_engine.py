from __future__ import annotations

from itertools import combinations

import numpy as np
import pandas as pd

DIMENSIONS = {"category", "status", "source", "region", "location", "delivery_mode", "person", "channel"}
NUMERIC = {"numeric", "currency", "percentage"}


def generate_visualizations(frame: pd.DataFrame, schema: list[dict], dimensions: list[dict],
                            base_charts: list[dict], revenue_column: str | None = None) -> tuple[list[dict], list[dict]]:
    charts = list(base_charts)
    correlations = []
    numeric_columns = [column["name"] for column in schema if column["semantic_type"] in NUMERIC and column["name"] in frame]
    metric_columns = numeric_columns[:6]

    for column in metric_columns[:4]:
        values = pd.to_numeric(frame[column], errors="coerce").dropna()
        if len(values) < 2 or values.nunique() < 2:
            continue
        bin_count = min(20, max(5, int(np.ceil(np.log2(len(values)) + 1))))
        counts, edges = np.histogram(values.to_numpy(dtype=float), bins=bin_count)
        points = [{"label": f"{edges[index]:,.3g}–{edges[index + 1]:,.3g}", "value": int(count)}
                  for index, count in enumerate(counts)]
        charts.append({"kind": "histogram", "title": f"Distribution of {column}", "x_key": "label",
                       "y_key": "value", "y_label": "records", "data": points, "source_columns": [column]})

    pair_values = []
    for left, right in combinations(metric_columns, 2):
        pair = frame[[left, right]].apply(pd.to_numeric, errors="coerce").dropna()
        if len(pair) < 3 or pair[left].nunique() < 2 or pair[right].nunique() < 2:
            continue
        coefficient = float(pair[left].corr(pair[right]))
        correlations.append({"x": left, "y": right, "pearson": round(coefficient, 4), "sample_size": int(len(pair))})
        pair_values.append((abs(coefficient), coefficient, left, right, pair))

    for _, coefficient, left, right, pair in sorted(pair_values, reverse=True)[:3]:
        chart_sample = pair.sample(n=500, random_state=42) if len(pair) > 500 else pair
        charts.append({"kind": "scatter", "title": f"{left} vs {right} (r={coefficient:.2f})",
                       "x_key": "x", "y_key": "y", "x_label": left, "y_label": right,
                       "data": [{"x": float(row[left]), "y": float(row[right])}
                                for _, row in chart_sample.iterrows()],
                       "source_columns": [left, right], "sampled": len(pair) > 500})

    dimensions_by_column = {item["column"]: item for item in dimensions}
    pie_count = 0
    for column in schema:
        if column["semantic_type"] not in DIMENSIONS or column["unique_count"] < 2 or column["unique_count"] > 6:
            continue
        dimension = dimensions_by_column.get(column["name"])
        if dimension and pie_count < 2:
            charts.append({"kind": "pie", "title": f"{column['original_name']} proportions", "data": dimension["values"],
                           "source_columns": [column["name"]]})
            pie_count += 1

    if not revenue_column:
        dimension_columns = [item["column"] for item in dimensions if item["unique_count"] <= 12]
        measure_columns = [column for column in numeric_columns if column in frame][:2]
        for dimension in dimension_columns[:3]:
            for metric in measure_columns:
                grouped = pd.to_numeric(frame[metric], errors="coerce").groupby(frame[dimension]).mean().dropna().sort_values(ascending=False).head(10)
                if len(grouped) < 2:
                    continue
                charts.append({"kind": "bar", "title": f"Average {metric} by {dimension}", "x_key": "label", "y_key": "value",
                               "y_label": metric, "data": [{"label": str(label), "value": round(float(value), 3)} for label, value in grouped.items()],
                               "source_columns": [dimension, metric]})
                break

    return charts, correlations
