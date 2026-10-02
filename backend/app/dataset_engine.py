import re
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd

from .services.ingestion import (
    MAX_UPLOAD_BYTES,
    ALLOWED_EXTENSIONS,
    detect_csv_encoding_and_delimiter,
    read_dataset_frame,
    get_excel_sheet_names,
    generate_preview,
    safe_filename,
)
from .services.cleaning import clean_dataset_frame
from .services.profiling import (
    PII_SEMANTICS,
    DIMENSION_SEMANTICS,
    classify_column,
    classify_dataset_domain,
    calculate_quality_report,
    calculate_numeric_statistics,
    mask_value,
    normalize_name,
)
from .services.kpi_engine import generate_kpis
from .services.chart_engine import generate_visualizations
from .services.insight_engine import generate_insights
from .services.anomaly_engine import detect_anomalies
from .services.forecast_engine import generate_forecast


def _group_counts(frame: pd.DataFrame, column: str, limit: int = 50) -> list[dict]:
    values = frame[column].dropna().astype(str).value_counts().head(limit)
    return [{"label": value, "value": int(count)} for value, count in values.items()]


def _group_sums(frame: pd.DataFrame, dimension: str, metric: str, limit: int = 10) -> list[dict]:
    grouped = frame.groupby(dimension, dropna=True)[metric].sum().sort_values(ascending=False).head(limit)
    return [{"label": str(value), "value": round(float(total), 2)} for value, total in grouped.items()]


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


def _time_series(frame: pd.DataFrame, schema: list[dict], numeric_column: str | None) -> tuple[str | None, str | None, list[dict]]:
    date_columns = [col["name"] for col in schema if col["semantic_type"] in {"datetime", "date"}]
    date_column = next(
        (col for col in date_columns if any(token in col for token in ("date", "created", "time", "timestamp", "admitted", "hire"))),
        date_columns[0] if date_columns else None
    )
    if not date_column or date_column not in frame.columns:
        return None, None, []

    valid = frame.dropna(subset=[date_column]).copy()
    if valid.empty:
        return date_column, None, []

    if not pd.api.types.is_datetime64_any_dtype(valid[date_column]):
        valid[date_column] = pd.to_datetime(valid[date_column], errors="coerce", format="mixed")
        valid = valid.dropna(subset=[date_column])

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
    if numeric_column and numeric_column in valid.columns:
        valid_num = pd.to_numeric(valid[numeric_column], errors="coerce")
        grouped = valid_num.groupby(valid["__period"]).sum()
        points = [{"period": _format_period(period, granularity), "value": round(float(val), 2)} for period, val in grouped.items()]
    else:
        grouped = valid.groupby("__period").size()
        points = [{"period": _format_period(period, granularity), "value": int(val)} for period, val in grouped.items()]

    return date_column, granularity, points


def analyze_dataset(raw_frame: pd.DataFrame, filename: str) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    if raw_frame.empty or len(raw_frame.columns) == 0:
        raise ValueError("The uploaded dataset has no rows or columns.")

    cleaned_frame, schema, cleaning = clean_dataset_frame(raw_frame)
    frame = cleaned_frame.copy()
    quality = calculate_quality_report(frame, schema, cleaning)

    revenue_column = next(
        (col["name"] for col in schema if col["semantic_type"] == "currency"
         and any(tok in col["name"] for tok in ("revenue", "sales", "amount", "total", "price", "value", "income"))
         and "price" not in col["name"]),
        None
    )
    revenue_source_columns = [revenue_column] if revenue_column else []
    derived_revenue = None

    if not revenue_column:
        price_col = next((col["name"] for col in schema if col["semantic_type"] == "currency" and "price" in col["name"]), None)
        qty_col = next((col["name"] for col in schema if col["semantic_type"] == "numeric" and any(tok in col["name"] for tok in ("quantity", "units"))), None)
        if price_col and qty_col:
            revenue_column = "__derived_revenue"
            revenue_source_columns = [price_col, qty_col]
            frame[revenue_column] = frame[price_col] * frame[qty_col]
            derived_revenue = {
                "column": revenue_column,
                "formula": f"{price_col} × {qty_col}",
                "source_columns": revenue_source_columns
            }

    profit_column = next((col["name"] for col in schema if col["semantic_type"] == "currency" and any(tok in col["name"] for tok in ("profit", "earning"))), None)

    # Dimensions
    dimensions = []
    base_charts = []
    for col in schema:
        if col["semantic_type"] in DIMENSION_SEMANTICS and 1 < col["unique_count"] <= 30:
            points = _group_counts(frame, col["name"])
            dimensions.append({
                "column": col["name"],
                "semantic_type": col["semantic_type"],
                "unique_count": col["unique_count"],
                "values": points
            })
            chart_points = _group_sums(frame, col["name"], revenue_column) if revenue_column else points
            measure = "revenue" if revenue_column else "records"
            base_charts.append({
                "kind": "bar",
                "title": f"{'Revenue' if revenue_column else 'Records'} by {col['original_name']}",
                "x_key": "label",
                "y_key": "value",
                "y_label": measure,
                "data": chart_points,
                "source_columns": [col["name"]] + revenue_source_columns
            })

    date_column, time_granularity, record_trend = _time_series(frame, schema, revenue_column)
    if record_trend:
        base_charts.append({
            "kind": "line",
            "title": f"{'Revenue' if revenue_column else 'Record creation'} trend",
            "x_key": "period",
            "y_key": "value",
            "y_label": "revenue" if revenue_column else "records",
            "data": record_trend,
            "source_columns": [date_column] + revenue_source_columns
        })

    charts, correlations = generate_visualizations(frame, schema, dimensions, base_charts, revenue_column)
    kpis = generate_kpis(frame, schema, quality, revenue_column, profit_column, date_column, record_trend, revenue_source_columns)
    numeric_statistics, outlier_alerts = calculate_numeric_statistics(frame, schema)
    dataset_type, type_confidence, entities = classify_dataset_domain(schema)

    # Compile alerts
    alerts: List[Dict[str, Any]] = []
    if quality["missing_values"]:
        alerts.append({
            "title": "Missing data detected",
            "detail": f"{quality['missing_values']:,} empty cells across {len(quality['missing_by_column'])} columns.",
            "severity": "medium",
            "source_columns": [item["column"] for item in quality["missing_by_column"]]
        })
    if quality["duplicate_rows"]:
        alerts.append({
            "title": "Duplicate records",
            "detail": f"{quality['duplicate_rows']:,} exact duplicate rows detected in upload.",
            "severity": "medium",
            "source_columns": []
        })

    for col in schema:
        inv_count = cleaning["invalid_values_by_column"].get(col["name"], 0)
        if inv_count:
            alerts.append({
                "title": f"Invalid {col['semantic_type']} values",
                "detail": f"{inv_count:,} values could not be parsed into valid format.",
                "severity": "high",
                "source_columns": [col["name"]]
            })

    for item in cleaning.get("duplicate_ids_by_column", []):
        alerts.append({
            "title": f"Repeated identifier: {item['column']}",
            "detail": f"{item['count']:,} identifier values are repeated.",
            "severity": "medium",
            "source_columns": [item["column"]]
        })

    for c in cleaning.get("empty_columns", []):
        alerts.append({"title": f"Empty column: {c}", "detail": "Contains no usable values.", "severity": "low", "source_columns": [c]})
    for c in cleaning.get("constant_columns", []):
        alerts.append({"title": f"Constant column: {c}", "detail": "Single distinct value across all rows.", "severity": "low", "source_columns": [c]})

    alerts.extend(outlier_alerts)

    # Anomaly Engine detection
    detected_anomalies = detect_anomalies(frame, schema, date_column, record_trend, revenue_column)

    # Insights
    insights = generate_insights(
        frame=frame,
        schema=schema,
        dimensions=dimensions,
        quality=quality,
        correlations=correlations,
        time_series=record_trend,
        revenue_column=revenue_column,
        revenue_sources=revenue_source_columns,
        date_column=date_column,
        numeric_stats=numeric_statistics
    )

    # Forecast
    forecast = generate_forecast(frame, schema, revenue_column, date_column)

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
        "columns": [
            {
                "name": item["name"],
                "original_name": item["original_name"],
                "dtype": item["data_type"],
                "missing_values": next((m["count"] for m in quality["missing_by_column"] if m["column"] == item["name"]), 0),
                "unique_values": item["unique_count"],
                "semantic_type": item["semantic_type"],
                "confidence": item["confidence"],
                "null_percentage": item["null_percentage"],
                "sample_values": item["sample_values"]
            }
            for item in schema
        ],
        "quality": quality,
        "quality_score": quality["overall_score"],
        "missing_values": quality["missing_values"],
        "duplicates": quality["duplicate_rows"],
        "cleaning_report": cleaning,
        "derived_metrics": [derived_revenue] if derived_revenue else [],
        "revenue_column": revenue_column,
        "sensitive_columns": [
            {
                "name": item["name"],
                "original_name": item.get("original_name", item["name"]),
                "semantic_type": item["semantic_type"],
                "message": "Potentially identifiable information; values are masked in analysis."
            }
            for item in schema
            if item["semantic_type"] in PII_SEMANTICS
        ],
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
        "anomalies": detected_anomalies,
        "source_filename": filename,
    }

    return cleaned_frame, report


def generate_answer(frame: pd.DataFrame, report: dict, question: str) -> dict:
    query = normalize_name(question)
    schema = report.get("schema", [])
    revenue_column = report.get("revenue_column")
    revenue_sources = [revenue_column] if revenue_column else []

    # Handle derived revenue in frame
    for derived in report.get("derived_metrics", []):
        if derived["column"] == revenue_column and revenue_column not in frame.columns:
            frame = frame.copy()
            frame[revenue_column] = frame[derived["source_columns"][0]] * frame[derived["source_columns"][1]]
            revenue_sources = derived["source_columns"]
            break

    # 1. Duplicates
    if "duplicate" in query:
        dups = report["quality"]["duplicate_rows"]
        return {
            "question": question,
            "answer": f"{dups} exact duplicate records were detected.",
            "evidence": [f"Duplicate rows: {dups}"],
            "top_contributor": None,
            "source_columns": [],
            "calculation": "Count rows with identical values across all columns",
            "query_intent": "duplicates"
        }

    # 2. Missing values and data quality
    if "missing" in query or "quality" in query:
        quality = report["quality"]
        evidence = [
            f"Quality score: {quality['overall_score']}%",
            f"Missing cells: {quality['missing_values']}",
            f"Duplicates: {quality['duplicate_rows']}"
        ]
        evidence.extend(f"{item['column']}: {item['count']} missing" for item in quality["missing_by_column"][:8])
        return {
            "question": question,
            "answer": f"The dataset quality score is {quality['overall_score']}%. It has {quality['missing_values']} missing cells and {quality['duplicate_rows']} duplicate rows.",
            "evidence": evidence,
            "top_contributor": quality["missing_by_column"][0] if quality["missing_by_column"] else None,
            "source_columns": [item["column"] for item in quality["missing_by_column"]],
            "calculation": "Completeness, uniqueness, validity, consistency and type correctness weighted equally",
            "query_intent": "data_quality"
        }

    # 3. Record count
    if "record" in query and any(tok in query for tok in ("how_many", "total", "count")):
        return {
            "question": question,
            "answer": f"The dataset contains {report['rows']:,} records.",
            "evidence": [f"Rows: {report['rows']:,}"],
            "top_contributor": None,
            "source_columns": [],
            "calculation": "COUNT(dataset rows)",
            "query_intent": "record_count"
        }

    # 4. Total Revenue
    if revenue_column and any(tok in query for tok in ("revenue", "sales", "income")) and not _match_column(schema, query):
        total = float(frame[revenue_column].sum())
        formula = f"SUM({revenue_sources[0]} × {revenue_sources[1]})" if len(revenue_sources) == 2 else f"SUM({revenue_column})"
        return {
            "question": question,
            "answer": f"Total revenue is {total:,.2f}.",
            "evidence": [f"Total revenue: {total:,.2f}"],
            "top_contributor": None,
            "source_columns": revenue_sources,
            "calculation": formula,
            "query_intent": "kpi_metric"
        }

    # 5. Why did sales decline / change?
    if any(tok in query for tok in ("why_did", "decline", "decrease", "drop", "change")) and any(tok in query for tok in ("sales", "revenue", "orders", "volume")):
        ts = report.get("time_series", [])
        if len(ts) >= 2:
            latest = float(ts[-1]["value"])
            prev = float(ts[-2]["value"])
            diff = latest - prev
            pct_change = (diff / max(prev, 1e-6)) * 100
            metric_label = revenue_column.replace("_", " ").title() if revenue_column else "volume"

            top_contributor = None
            if revenue_column and revenue_column in frame.columns and report.get("dimensions"):
                dim = report["dimensions"][0]["column"]
                try:
                    sums = frame.groupby(dim)[revenue_column].sum().sort_values(ascending=False)
                    if not sums.empty:
                        top_contributor = {"category": str(sums.index[0]), "revenue": round(float(sums.iloc[0]), 2)}
                except Exception:
                    pass

            ans = f"{metric_label} {'decreased' if pct_change < 0 else 'increased'} by {abs(pct_change):.1f}% in the latest period ({ts[-1]['period']})."
            evidence = [
                f"Latest {metric_label}: {latest:,.2f} ({ts[-1]['period']})",
                f"Previous {metric_label}: {prev:,.2f} ({ts[-2]['period']})",
                f"Net change: {pct_change:+.1f}%"
            ]
            if top_contributor:
                evidence.append(f"Top performing {report['dimensions'][0]['semantic_type']}: {top_contributor['category']} ({top_contributor['revenue']:,.2f})")

            return {
                "question": question,
                "answer": ans,
                "evidence": evidence,
                "top_contributor": top_contributor,
                "source_columns": [report.get("date_column", "date")] + revenue_sources,
                "calculation": f"(latest_period ({latest:,.2f}) / previous_period ({prev:,.2f}) - 1) × 100",
                "query_intent": "trend_analysis"
            }

    # 6. Specific Column Analysis (dimension, metric, PII, etc.)
    column = _match_column(schema, query)
    if column and column in frame.columns:
        metadata = next(item for item in schema if item["name"] == column)
        if metadata["semantic_type"] in PII_SEMANTICS:
            count = int(frame[column].nunique(dropna=True))
            return {
                "question": question,
                "answer": f"There are {count:,} unique values in {metadata['original_name']}. Individual values are hidden because this field is sensitive.",
                "evidence": [f"Unique values: {count:,}"],
                "top_contributor": None,
                "source_columns": [column],
                "calculation": f"COUNT(DISTINCT {column}); values masked",
                "query_intent": "pii"
            }

        metric_column = revenue_column or next(
            (item["name"] for item in schema if item["semantic_type"] == "currency"
             and any(token in item["name"] for token in ("revenue", "sales", "amount", "total", "price", "value"))),
            None
        )

        if metadata["semantic_type"] in DIMENSION_SEMANTICS and metric_column and any(token in query for token in ("revenue", "sales", "amount")):
            values = _group_sums(frame, column, metric_column, limit=8)
            if values:
                answer = f"{values[0]['label']} has the highest {metric_column} ({values[0]['value']:,.2f})."
                evidence = [f"{item['label']}: {item['value']:,.2f}" for item in values[:6]]
                sources = [column] + revenue_sources
                calculation = (
                    f"SUM({revenue_sources[0]} × {revenue_sources[1]}) grouped by {column}, sorted descending"
                    if len(revenue_sources) == 2
                    else f"SUM({metric_column}) grouped by {column}, sorted descending"
                )
                return {
                    "question": question,
                    "answer": answer,
                    "evidence": evidence,
                    "top_contributor": {"label": values[0]["label"], "value": values[0]["value"]},
                    "source_columns": sources,
                    "calculation": calculation,
                    "query_intent": "dimension_metric"
                }

        if metadata["semantic_type"] in {"numeric", "currency", "percentage"}:
            values = pd.to_numeric(frame[column], errors="coerce").dropna()
            if not values.empty:
                if any(token in query for token in ("average", "mean", "avg")):
                    operation, result = "AVG", float(values.mean())
                elif "median" in query:
                    operation, result = "MEDIAN", float(values.median())
                elif any(token in query for token in ("lowest", "minimum", "smallest", "min")):
                    operation, result = "MIN", float(values.min())
                elif any(token in query for token in ("highest", "maximum", "largest", "max")):
                    operation, result = "MAX", float(values.max())
                else:
                    operation, result = "SUM", float(values.sum())

                fmt_res = f"{result:,.2f}"
                return {
                    "question": question,
                    "answer": f"{operation.title()} {metadata['original_name']} is {fmt_res}.",
                    "evidence": [
                        f"Count: {len(values):,}",
                        f"Minimum: {values.min():,.2f}",
                        f"Maximum: {values.max():,.2f}"
                    ],
                    "top_contributor": None,
                    "source_columns": [column],
                    "calculation": f"{operation}({column})",
                    "query_intent": "numeric_aggregation"
                }

        values = _group_counts(frame, column, 8)
        if not values:
            return {
                "question": question,
                "answer": f"No non-empty values are available for {metadata['original_name']}.",
                "evidence": [],
                "top_contributor": None,
                "source_columns": [column],
                "calculation": f"GROUP BY {column}",
                "query_intent": "empty"
            }

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
        return {
            "question": question,
            "answer": answer,
            "evidence": evidence,
            "top_contributor": {"label": values[0]["label"], "count": values[0]["value"]},
            "source_columns": [column],
            "calculation": calculation,
            "query_intent": "categorical_breakdown"
        }

    # 7. Trends
    if any(token in query for token in ("trend", "monthly", "over_time")) and report.get("time_series"):
        points = report["time_series"]
        evidence = [f"{item['period']}: {item['value']}" for item in points[-6:]]
        return {
            "question": question,
            "answer": f"The dataset has {len(points)} monthly periods from {points[0]['period']} to {points[-1]['period']}.",
            "evidence": evidence,
            "top_contributor": None,
            "source_columns": [report["date_column"]],
            "calculation": "COUNT(records) grouped by month",
            "query_intent": "trend"
        }

    # 8. Forecast query
    if any(token in query for token in ("forecast", "future", "predict")):
        fc = report.get("forecast", {})
        if fc.get("available") and fc.get("values"):
            next_p = fc["values"][0]
            fmt_v = f"₹{next_p['value']:,.2f}" if "revenue" in fc.get("metric", "") else f"{next_p['value']:,.0f}"
            return {
                "question": question,
                "answer": f"Projected {fc.get('metric', 'value')} for {next_p['period']} is {fmt_v} ({fc.get('model_name', '')}).",
                "evidence": [f"{p['period']}: {p['value']:,.2f}" for p in fc["values"][:4]],
                "top_contributor": next_p,
                "source_columns": fc.get("source_columns", []),
                "calculation": f"Model: {fc.get('model_name')}",
                "query_intent": "forecast"
            }

    # 9. Outliers & Anomalies query
    if any(token in query for token in ("unusual", "outlier", "anomaly")):
        anomalies = report.get("anomalies", [])
        if anomalies:
            first = anomalies[0]
            return {
                "question": question,
                "answer": f"Detected {len(anomalies)} statistical anomalies. Example: {first['title']} ({first['detail']}).",
                "evidence": [f"{a['title']}: {a['detail']}" for a in anomalies[:5]],
                "top_contributor": {"metric": first["metric"], "observed": first["observed"]},
                "source_columns": first.get("source_columns", []),
                "calculation": f"Method: {first.get('method')}",
                "query_intent": "anomalies"
            }

    # 10. Correlations query
    if any(token in query for token in ("correlation", "relationship", "correlated")):
        corrs = report.get("correlations", [])
        if corrs:
            top_corr = sorted(corrs, key=lambda c: abs(c["pearson"]), reverse=True)[0]
            direction = "positive" if top_corr["pearson"] > 0 else "negative"
            return {
                "question": question,
                "answer": f"Strongest correlation is between {top_corr['x']} and {top_corr['y']} (r = {top_corr['pearson']:.2f}, {direction}).",
                "evidence": [f"{c['x']} & {c['y']}: r = {c['pearson']:.3f}" for c in corrs[:5]],
                "top_contributor": top_corr,
                "source_columns": [top_corr["x"], top_corr["y"]],
                "calculation": f"Pearson r({top_corr['x']}, {top_corr['y']})",
                "query_intent": "correlation"
            }

    # 11. Fallback Summary
    return {
        "question": question,
        "answer": f"This {report['dataset_type']} dataset has {report['rows']:,} rows and {report['column_count']} columns. Ask about a detected field or data quality.",
        "evidence": [
            f"Dataset type: {report['dataset_type']}",
            f"Rows: {report['rows']:,}",
            f"Quality: {report['quality_score']}%"
        ],
        "top_contributor": None,
        "source_columns": [],
        "calculation": "Read dataset profile",
        "query_intent": "summary"
    }


def _match_column(schema: list[dict], query: str) -> str | None:
    tokens = set(query.split("_"))

    # 1. Direct match on column names or original names first
    for item in schema:
        col_norm = normalize_name(item["name"])
        orig_norm = normalize_name(item["original_name"])
        if col_norm in tokens or orig_norm in tokens or f"_{col_norm}_" in f"_{query}_":
            # Guard against common subwords like 'age' in 'average'
            if col_norm == "age" and "age" not in tokens:
                continue
            return item["name"]

    # 2. Semantic term matching
    semantic_terms = {
        "region": ("region", "location", "area", "zone", "city", "country", "state"),
        "source": ("source", "channel", "medium"),
        "status": ("status", "outcome", "attrition"),
        "delivery_mode": ("delivery", "shipping"),
        "person": ("agent", "sales_person", "employee"),
        "category": ("category", "department", "segment", "treatment", "condition"),
    }
    for sem, terms in semantic_terms.items():
        if any(term in tokens or any(term in tok for tok in tokens) for term in terms):
            m = next((item["name"] for item in schema if item["semantic_type"] == sem), None)
            if m:
                return m

    for item in schema:
        if item["name"] in tokens or normalize_name(item["original_name"]) in tokens:
            return item["name"]
    return None
