from __future__ import annotations
from typing import Any, Dict, List, Optional, Union
import numpy as np
import pandas as pd


def execute_visual_query(
    frame: pd.DataFrame,
    chart_type: str,
    x_col: Optional[str] = None,
    y_col: Optional[Union[str, List[str]]] = None,
    legend_col: Optional[str] = None,
    size_col: Optional[str] = None,
    aggregation: str = "sum",
    date_hierarchy: str = "auto",
    filters: Optional[List[Dict[str, Any]]] = None,
    cross_filter: Optional[Dict[str, Any]] = None,
    sort_by: str = "value",
    sort_order: str = "desc",
    top_n: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Executes a dynamic Power BI-style visual aggregation query against the dataset frame.
    Supports filtering, cross-filtering, date hierarchies, multiple aggregations,
    multi-series pivoting, boxplot statistics, heatmaps, funnels, gauges, and KPI cards.
    """
    df = frame.copy()

    # 1. Apply Active Slicers & Filters
    if filters:
        for f in filters:
            col = f.get("column")
            op = f.get("operator", "eq")
            val = f.get("value")
            if not col or col not in df.columns or val is None:
                continue
            if op == "eq":
                df = df[df[col].astype(str) == str(val)]
            elif op == "in" and isinstance(val, list):
                val_strs = {str(v) for v in val}
                df = df[df[col].astype(str).isin(val_strs)]
            elif op == "gte":
                df = df[pd.to_numeric(df[col], errors="coerce") >= float(val)]
            elif op == "lte":
                df = df[pd.to_numeric(df[col], errors="coerce") <= float(val)]
            elif op == "date_range" and isinstance(val, (list, tuple)) and len(val) == 2:
                dates = pd.to_datetime(df[col], errors="coerce")
                start = pd.to_datetime(val[0], errors="coerce")
                end = pd.to_datetime(val[1], errors="coerce")
                if pd.notna(start):
                    df = df[dates >= start]
                if pd.notna(end):
                    df = df[dates <= end]

    # 2. Apply Cross-Filter (from clicking any chart visual element)
    if cross_filter and isinstance(cross_filter, dict):
        cf_col = cross_filter.get("column")
        cf_val = cross_filter.get("value")
        if cf_col and cf_col in df.columns and cf_val is not None:
            df = df[df[cf_col].astype(str) == str(cf_val)]

    total_filtered_rows = len(df)
    if total_filtered_rows == 0:
        return {
            "chart_type": chart_type,
            "data": [],
            "total_rows": 0,
            "message": "No data matching active filters",
            "series": []
        }

    # Normalize y_col
    y_cols = [y_col] if isinstance(y_col, str) else (y_col or [])

    # 3. Handle Date Hierarchy if X is a date
    x_transformed = x_col
    if x_col and x_col in df.columns:
        # Check if x_col is or can be datetime
        parsed_dates = pd.to_datetime(df[x_col], errors="coerce", format="mixed")
        valid_date_ratio = parsed_dates.notna().mean()
        if valid_date_ratio > 0.5:
            df["_parsed_date"] = parsed_dates
            df = df.dropna(subset=["_parsed_date"])
            span_days = (df["_parsed_date"].max() - df["_parsed_date"].min()).days if len(df) > 0 else 0

            target_granularity = date_hierarchy
            if target_granularity == "auto":
                if span_days > 730:
                    target_granularity = "year"
                elif span_days > 180:
                    target_granularity = "quarter"
                elif span_days > 35:
                    target_granularity = "month"
                else:
                    target_granularity = "day"

            if target_granularity == "year":
                df["_hierarchy_x"] = df["_parsed_date"].dt.strftime("%Y")
                df["_sort_key"] = df["_parsed_date"].dt.strftime("%Y")
            elif target_granularity == "quarter":
                df["_hierarchy_x"] = df["_parsed_date"].dt.year.astype(str) + "-Q" + df["_parsed_date"].dt.quarter.astype(str)
                df["_sort_key"] = df["_parsed_date"].dt.year.astype(str) + "-Q" + df["_parsed_date"].dt.quarter.astype(str)
            elif target_granularity == "month":
                df["_hierarchy_x"] = df["_parsed_date"].dt.strftime("%Y-%m")
                df["_sort_key"] = df["_parsed_date"].dt.strftime("%Y-%m")
            else:
                df["_hierarchy_x"] = df["_parsed_date"].dt.strftime("%Y-%m-%d")
                df["_sort_key"] = df["_parsed_date"].dt.strftime("%Y-%m-%d")
            x_transformed = "_hierarchy_x"

    # Aggregator helper
    def agg_series(s: pd.Series, agg_type: str) -> float:
        numeric_s = pd.to_numeric(s, errors="coerce").dropna()
        if agg_type == "count":
            return float(len(s.dropna()))
        elif agg_type == "distinct_count":
            return float(s.nunique())
        elif len(numeric_s) == 0:
            return 0.0
        elif agg_type == "sum":
            return float(numeric_s.sum())
        elif agg_type == "avg":
            return float(numeric_s.mean())
        elif agg_type == "min":
            return float(numeric_s.min())
        elif agg_type == "max":
            return float(numeric_s.max())
        elif agg_type == "median":
            return float(numeric_s.median())
        elif agg_type == "pct":
            total = pd.to_numeric(df[s.name], errors="coerce").dropna().sum()
            return float(numeric_s.sum() / total * 100) if total else 0.0
        return float(numeric_s.sum())

    # 4. Route by Visual Type

    # --- KPI CARD ---
    if chart_type in {"kpi_card", "kpi"}:
        metric_col = y_cols[0] if y_cols else (x_col if x_col in df.columns else None)
        if not metric_col or metric_col not in df.columns:
            return {"chart_type": chart_type, "value": total_filtered_rows, "label": "Records"}
        
        curr_val = agg_series(df[metric_col], aggregation)
        prior_val = None
        variance_pct = None
        variance_abs = None
        sparkline = []

        # Calculate prior comparison if date column exists
        date_cols = [c for c in df.columns if pd.to_datetime(df[c], errors="coerce", format="mixed").notna().mean() > 0.5]
        if date_cols:
            dt_series = pd.to_datetime(df[date_cols[0]], errors="coerce", format="mixed")
            df_sorted = df.assign(_dt=dt_series).dropna(subset=["_dt"]).sort_values("_dt")
            if len(df_sorted) >= 4:
                half = len(df_sorted) // 2
                prior_half = df_sorted.iloc[:half]
                curr_half = df_sorted.iloc[half:]
                prior_val = agg_series(prior_half[metric_col], aggregation)
                if prior_val != 0:
                    variance_abs = curr_val - prior_val
                    variance_pct = round(((curr_val - prior_val) / abs(prior_val)) * 100, 2)

                # Generate 8-point sparkline
                chunk_size = max(1, len(df_sorted) // 8)
                for idx in range(0, len(df_sorted), chunk_size):
                    chunk = df_sorted.iloc[idx:idx + chunk_size]
                    if len(chunk) > 0:
                        sparkline.append({
                            "period": str(chunk["_dt"].iloc[0])[:10],
                            "value": round(agg_series(chunk[metric_col], aggregation), 2)
                        })
        if not sparkline:
            # Fallback sparkline across row chunks
            chunk_size = max(1, len(df) // 8)
            for idx in range(0, len(df), chunk_size):
                chunk = df.iloc[idx:idx + chunk_size]
                sparkline.append({
                    "period": f"P{len(sparkline)+1}",
                    "value": round(agg_series(chunk[metric_col], aggregation), 2)
                })

        target_val = round(curr_val * 1.15, 2)  # Benchmark target (+15%)
        achievement_pct = round((curr_val / target_val * 100), 1) if target_val else 100.0

        return {
            "chart_type": "kpi_card",
            "metric": metric_col,
            "value": round(curr_val, 2),
            "prior_value": round(prior_val, 2) if prior_val is not None else None,
            "variance_pct": variance_pct,
            "variance_abs": round(variance_abs, 2) if variance_abs is not None else None,
            "target": target_val,
            "achievement_pct": achievement_pct,
            "sparkline": sparkline,
            "total_rows": total_filtered_rows,
        }

    # --- GAUGE ---
    if chart_type == "gauge":
        metric_col = y_cols[0] if y_cols else x_col
        num_s = pd.to_numeric(df[metric_col], errors="coerce").dropna() if metric_col else pd.Series([])
        curr_val = agg_series(df[metric_col], aggregation) if metric_col else float(total_filtered_rows)
        min_val = float(num_s.min()) if len(num_s) > 0 and aggregation in {"min", "avg"} else 0.0
        max_val = float(num_s.max()) if len(num_s) > 0 and aggregation != "pct" else (100.0 if aggregation == "pct" else max(curr_val * 1.3, 100.0))
        target_val = round(max_val * 0.8, 2)
        pct = round((curr_val - min_val) / (max_val - min_val) * 100, 1) if (max_val - min_val) > 0 else 50.0

        return {
            "chart_type": "gauge",
            "metric": metric_col or "Records",
            "value": round(curr_val, 2),
            "min": round(min_val, 2),
            "max": round(max_val, 2),
            "target": target_val,
            "pct": max(0.0, min(100.0, pct)),
            "total_rows": total_filtered_rows,
        }

    # --- BOX PLOT ---
    if chart_type == "box_plot":
        measure_col = y_cols[0] if y_cols else x_col
        cat_col = x_col if (y_cols and x_col and x_col != y_cols[0]) else None
        results = []

        if cat_col and cat_col in df.columns:
            top_cats = df[cat_col].astype(str).value_counts().head(top_n or 8).index
            for cat in top_cats:
                vals = pd.to_numeric(df[df[cat_col].astype(str) == cat][measure_col], errors="coerce").dropna().sort_values()
                if len(vals) >= 4:
                    q1 = float(vals.quantile(0.25))
                    med = float(vals.median())
                    q3 = float(vals.quantile(0.75))
                    iqr = q3 - q1
                    low_fence = max(float(vals.min()), q1 - 1.5 * iqr)
                    high_fence = min(float(vals.max()), q3 + 1.5 * iqr)
                    outliers = [float(v) for v in vals[(vals < low_fence) | (vals > high_fence)].head(20)]
                    results.append({
                        "category": str(cat),
                        "min": round(low_fence, 2),
                        "q1": round(q1, 2),
                        "median": round(med, 2),
                        "q3": round(q3, 2),
                        "max": round(high_fence, 2),
                        "outliers": outliers,
                        "count": len(vals)
                    })
        else:
            vals = pd.to_numeric(df[measure_col], errors="coerce").dropna().sort_values()
            if len(vals) >= 4:
                q1 = float(vals.quantile(0.25))
                med = float(vals.median())
                q3 = float(vals.quantile(0.75))
                iqr = q3 - q1
                low_fence = max(float(vals.min()), q1 - 1.5 * iqr)
                high_fence = min(float(vals.max()), q3 + 1.5 * iqr)
                outliers = [float(v) for v in vals[(vals < low_fence) | (vals > high_fence)].head(20)]
                results.append({
                    "category": str(measure_col),
                    "min": round(low_fence, 2),
                    "q1": round(q1, 2),
                    "median": round(med, 2),
                    "q3": round(q3, 2),
                    "max": round(high_fence, 2),
                    "outliers": outliers,
                    "count": len(vals)
                })

        return {
            "chart_type": "box_plot",
            "metric": measure_col,
            "data": results,
            "total_rows": total_filtered_rows,
        }

    # --- HEATMAP ---
    if chart_type == "heatmap":
        dim_x = x_col or (df.columns[0] if len(df.columns) > 0 else "X")
        dim_y = legend_col or (df.columns[1] if len(df.columns) > 1 else "Y")
        val_col = y_cols[0] if y_cols else None

        # Take top 8 values of each dimension to keep grid clean
        top_x = df[dim_x].astype(str).value_counts().head(8).index.tolist()
        top_y = df[dim_y].astype(str).value_counts().head(8).index.tolist()

        sub_df = df[df[dim_x].astype(str).isin(top_x) & df[dim_y].astype(str).isin(top_y)]
        
        matrix_cells = []
        raw_vals = []
        for x_val in top_x:
            for y_val in top_y:
                matching = sub_df[(sub_df[dim_x].astype(str) == x_val) & (sub_df[dim_y].astype(str) == y_val)]
                cell_val = agg_series(matching[val_col], aggregation) if val_col and len(matching) > 0 else float(len(matching))
                raw_vals.append(cell_val)
                matrix_cells.append({
                    "x": x_val,
                    "y": y_val,
                    "value": round(cell_val, 2)
                })

        max_v = max(raw_vals) if raw_vals else 1.0
        min_v = min(raw_vals) if raw_vals else 0.0
        range_v = (max_v - min_v) if (max_v - min_v) > 0 else 1.0

        for cell in matrix_cells:
            cell["intensity"] = round((cell["value"] - min_v) / range_v, 3)

        return {
            "chart_type": "heatmap",
            "x_axis": dim_x,
            "y_axis": dim_y,
            "metric": val_col or "Count",
            "x_categories": top_x,
            "y_categories": top_y,
            "data": matrix_cells,
            "min_val": round(min_v, 2),
            "max_val": round(max_v, 2),
            "total_rows": total_filtered_rows,
        }

    # --- FUNNEL ---
    if chart_type == "funnel":
        dim = x_col or (df.columns[0] if len(df.columns) > 0 else "Stage")
        val_col = y_cols[0] if y_cols else None

        grouped = df.groupby(df[dim].astype(str))
        stages = []
        for stage_name, grp in grouped:
            val = agg_series(grp[val_col], aggregation) if val_col else float(len(grp))
            stages.append({"stage": stage_name, "value": val})

        # Sort descending by default for funnel flow
        stages.sort(key=lambda s: s["value"], reverse=True)
        if top_n:
            stages = stages[:top_n]

        top_val = stages[0]["value"] if stages and stages[0]["value"] > 0 else 1.0
        prev_val = top_val
        for idx, s in enumerate(stages):
            s["pct_of_first"] = round((s["value"] / top_val) * 100, 1)
            s["pct_of_prev"] = round((s["value"] / prev_val) * 100, 1) if prev_val > 0 else 100.0
            prev_val = s["value"]

        return {
            "chart_type": "funnel",
            "dimension": dim,
            "data": stages,
            "total_rows": total_filtered_rows,
        }

    # --- SCATTER / BUBBLE ---
    if chart_type in {"scatter", "bubble"}:
        x_m = x_col if x_col in df.columns else (y_cols[0] if y_cols else df.columns[0])
        y_m = y_cols[0] if y_cols and y_cols[0] != x_m else (y_cols[1] if len(y_cols) > 1 else (df.columns[1] if len(df.columns) > 1 else x_m))
        sz_m = size_col if (size_col and size_col in df.columns) else (y_cols[1] if len(y_cols) > 1 and y_cols[1] != y_m else None)

        clean_sub = df[[x_m, y_m]].apply(pd.to_numeric, errors="coerce").dropna()
        if len(clean_sub) > 600:
            clean_sub = clean_sub.sample(n=600, random_state=42)

        data_pts = []
        try:
            corr = float(clean_sub[x_m].corr(clean_sub[y_m]))
            corr = 0.0 if np.isnan(corr) else round(corr, 3)
        except Exception:
            corr = 0.0

        for idx, row in clean_sub.iterrows():
            pt = {"x": float(row[x_m]), "y": float(row[y_m])}
            if sz_m and sz_m in df.columns:
                try:
                    pt["size"] = float(df.loc[idx, sz_m])
                except Exception:
                    pt["size"] = 10.0
            else:
                pt["size"] = 10.0
            data_pts.append(pt)

        return {
            "chart_type": chart_type,
            "x_axis": x_m,
            "y_axis": y_m,
            "size_axis": sz_m,
            "correlation": corr,
            "data": data_pts,
            "total_rows": total_filtered_rows,
        }

    # --- HISTOGRAM ---
    if chart_type == "histogram":
        meas = y_cols[0] if y_cols else x_col
        num_s = pd.to_numeric(df[meas], errors="coerce").dropna()
        if len(num_s) < 2 or num_s.nunique() < 2:
            return {"chart_type": "histogram", "data": [], "message": "Not enough numeric variation"}
        bins = min(20, max(6, int(np.ceil(np.log2(len(num_s)) + 1))))
        counts, edges = np.histogram(num_s.to_numpy(dtype=float), bins=bins)
        hist_data = [
            {
                "bin": f"{edges[i]:,.2f}–{edges[i+1]:,.2f}",
                "lower": float(edges[i]),
                "upper": float(edges[i+1]),
                "count": int(cnt),
                "frequency": round(int(cnt) / len(num_s) * 100, 1)
            }
            for i, cnt in enumerate(counts)
        ]
        return {
            "chart_type": "histogram",
            "metric": meas,
            "data": hist_data,
            "total_rows": total_filtered_rows,
        }

    # --- TREEMAP ---
    if chart_type == "treemap":
        dim = x_transformed or x_col or (df.columns[0] if len(df.columns) > 0 else "Category")
        val_col = y_cols[0] if y_cols else None

        grouped = df.groupby(df[dim].astype(str))
        nodes = []
        for name, grp in grouped:
            val = agg_series(grp[val_col], aggregation) if val_col else float(len(grp))
            nodes.append({"name": name, "value": val})

        nodes.sort(key=lambda n: n["value"], reverse=True)
        if top_n:
            nodes = nodes[:top_n]

        total_sum = sum(n["value"] for n in nodes) or 1.0
        for n in nodes:
            n["pct"] = round(n["value"] / total_sum * 100, 1)
            n["formatted"] = f"{n['value']:,.2f}"

        return {
            "chart_type": "treemap",
            "dimension": dim,
            "metric": val_col or "Count",
            "data": nodes,
            "total_rows": total_filtered_rows,
        }

    # --- COMBO CHART (Dual Measure / Bar + Line) ---
    if chart_type == "combo":
        dim = x_transformed or x_col or (df.columns[0] if len(df.columns) > 0 else "Category")
        primary_metric = y_cols[0] if len(y_cols) > 0 else None
        secondary_metric = y_cols[1] if len(y_cols) > 1 else None

        grouped = df.groupby(df[dim].astype(str))
        rows = []
        for name, grp in grouped:
            item = {"label": name}
            if primary_metric:
                item[primary_metric] = round(agg_series(grp[primary_metric], aggregation), 2)
            else:
                item["Records"] = len(grp)
            if secondary_metric:
                item[secondary_metric] = round(agg_series(grp[secondary_metric], "avg" if aggregation == "sum" else aggregation), 2)
            rows.append(item)

        # Sort
        sort_field = primary_metric or "Records"
        if sort_by == "label":
            rows.sort(key=lambda r: r["label"], reverse=(sort_order == "desc"))
        else:
            rows.sort(key=lambda r: r.get(sort_field, 0), reverse=(sort_order == "desc"))

        if top_n:
            rows = rows[:top_n]

        return {
            "chart_type": "combo",
            "x_axis": dim,
            "primary_metric": primary_metric or "Records",
            "secondary_metric": secondary_metric,
            "data": rows,
            "total_rows": total_filtered_rows,
        }

    # --- STACKED BAR / STACKED COLUMN ---
    if chart_type in {"stacked_bar", "stacked_column"} or (legend_col and legend_col in df.columns):
        dim_x = x_transformed or x_col or df.columns[0]
        dim_legend = legend_col if (legend_col and legend_col in df.columns) else (df.columns[1] if len(df.columns) > 1 else None)
        val_col = y_cols[0] if y_cols else None

        if dim_legend and dim_legend != dim_x:
            # Pivot table
            top_x = df[dim_x].astype(str).value_counts().head(top_n or 10).index.tolist()
            top_legend = df[dim_legend].astype(str).value_counts().head(6).index.tolist()
            sub = df[df[dim_x].astype(str).isin(top_x) & df[dim_legend].astype(str).isin(top_legend)]

            pivoted = []
            for x_val in top_x:
                row_item = {"label": x_val, "total": 0.0}
                for leg_val in top_legend:
                    matching = sub[(sub[dim_x].astype(str) == x_val) & (sub[dim_legend].astype(str) == leg_val)]
                    val = agg_series(matching[val_col], aggregation) if val_col and len(matching) > 0 else float(len(matching))
                    row_item[leg_val] = round(val, 2)
                    row_item["total"] += val
                row_item["total"] = round(row_item["total"], 2)
                pivoted.append(row_item)

            if sort_by == "label":
                pivoted.sort(key=lambda r: r["label"], reverse=(sort_order == "desc"))
            else:
                pivoted.sort(key=lambda r: r["total"], reverse=(sort_order == "desc"))

            return {
                "chart_type": chart_type,
                "x_axis": dim_x,
                "legend": dim_legend,
                "series": top_legend,
                "data": pivoted,
                "total_rows": total_filtered_rows,
            }

    # --- GENERAL AGGREGATION (Column, Bar, Line, Area, Pie, Donut, Table) ---
    dim = x_transformed or x_col or (df.columns[0] if len(df.columns) > 0 else "Category")
    metric = y_cols[0] if y_cols else None

    grouped = df.groupby(df[dim].astype(str))
    aggregated_rows = []
    total_val_sum = 0.0

    for name, grp in grouped:
        val = agg_series(grp[metric], aggregation) if metric else float(len(grp))
        val_rounded = round(val, 2)
        total_val_sum += val_rounded
        aggregated_rows.append({
            "label": str(name),
            "value": val_rounded,
            "count": len(grp)
        })

    # Percentage of total if needed
    for r in aggregated_rows:
        r["percentage"] = round((r["value"] / total_val_sum * 100), 1) if total_val_sum > 0 else 0.0

    # Sorting
    if sort_by == "label":
        aggregated_rows.sort(key=lambda r: r["label"], reverse=(sort_order == "desc"))
    else:
        aggregated_rows.sort(key=lambda r: r["value"], reverse=(sort_order == "desc"))

    if top_n:
        aggregated_rows = aggregated_rows[:top_n]

    return {
        "chart_type": chart_type,
        "x_axis": dim,
        "metric": metric or "Count",
        "aggregation": aggregation,
        "data": aggregated_rows,
        "total_value": round(total_val_sum, 2),
        "total_rows": total_filtered_rows,
    }
