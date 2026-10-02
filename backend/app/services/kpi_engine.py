from __future__ import annotations

import pandas as pd


def _find(schema: list[dict], predicate) -> str | None:
    return next((column["name"] for column in schema if predicate(column)), None)


def generate_kpis(frame: pd.DataFrame, schema: list[dict], quality: dict,
                  revenue_column: str | None = None, profit_column: str | None = None,
                  date_column: str | None = None, time_series: list[dict] | None = None,
                  revenue_source_columns: list[str] | None = None) -> list[dict]:
    kpis = [
        {"label": "Total Records", "value": int(len(frame)), "format": "count", "source_columns": []},
        {"label": "Columns", "value": int(len(frame.columns)), "format": "count", "source_columns": []},
        {"label": "Data Quality", "value": quality["overall_score"], "format": "percent", "source_columns": []},
        {"label": "Missing Values", "value": quality["missing_values"], "format": "count", "source_columns": []},
        {"label": "Duplicate Records", "value": quality["duplicate_rows"], "format": "count", "source_columns": []},
    ]
    used_columns = set()
    revenue_sources = revenue_source_columns or ([revenue_column] if revenue_column else [])
    add_kpi = lambda label, value, metric_format, columns: kpis.append({
        "label": label, "value": value, "format": metric_format, "source_columns": columns
    })

    for column in schema:
        name = column["name"]
        normalized = name.lower()
        semantic = column["semantic_type"]
        distinct_count = int(frame[name].nunique(dropna=True))
        if semantic == "identifier":
            if any(token in normalized for token in ("product", "item", "sku")):
                add_kpi("Unique Products", distinct_count, "count", [name])
            if any(token in normalized for token in ("employee", "staff", "worker")):
                add_kpi("Employees", distinct_count, "count", [name])
            if any(token in normalized for token in ("patient",)):
                add_kpi("Patients", distinct_count, "count", [name])
            if any(token in normalized for token in ("customer", "client", "contact")):
                add_kpi("Unique Customers", distinct_count, "count", [name])
        if semantic == "person":
            add_kpi(f"Unique {column['original_name']}", distinct_count, "count", [name])
        if semantic in {"region", "location"}:
            add_kpi("Regions" if "region" in normalized else "Locations", distinct_count, "count", [name])
        if semantic == "status":
            add_kpi("Statuses", distinct_count, "count", [name])
        if semantic == "delivery_mode":
            add_kpi("Delivery Modes", distinct_count, "count", [name])
        if semantic in {"category", "source"} and distinct_count <= 100:
            label = "Departments" if "department" in normalized else f"{column['original_name']} Count"
            add_kpi(label, distinct_count, "count", [name])
            if any(token in normalized for token in ("product", "item", "sku")):
                add_kpi("Unique Products", distinct_count, "count", [name])

        if semantic in {"numeric", "currency", "percentage"}:
            values = pd.to_numeric(frame[name], errors="coerce").dropna()
            if values.empty:
                continue
            if semantic == "currency" and name not in {revenue_column, profit_column}:
                add_kpi(f"Total {column['original_name']}", round(float(values.sum()), 2), "currency", [name])
                used_columns.add(name)
            if "age" in normalized:
                add_kpi("Average Age", round(float(values.mean()), 2), "number", [name])
                used_columns.add(name)
            elif "salary" in normalized:
                add_kpi("Average Salary", round(float(values.mean()), 2), "currency", [name])
                used_columns.add(name)
            elif "experience" in normalized or "tenure" in normalized:
                add_kpi("Average Experience", round(float(values.mean()), 2), "number", [name])
                used_columns.add(name)

    orders_column = _find(schema, lambda column: column["semantic_type"] == "numeric" and "order" in column["name"])
    order_id_column = _find(schema, lambda column: column["semantic_type"] == "identifier" and "order" in column["name"])
    customers_column = _find(schema, lambda column: column["semantic_type"] == "numeric" and "customer" in column["name"])
    if orders_column:
        add_kpi("Total Orders", int(frame[orders_column].sum()), "count", [orders_column])
    elif order_id_column:
        add_kpi("Total Orders", int(frame[order_id_column].nunique(dropna=True)), "count", [order_id_column])
    if customers_column:
        add_kpi("Total Customers", int(frame[customers_column].sum()), "count", [customers_column])
    quantity_column = _find(schema, lambda column: column["semantic_type"] == "numeric" and any(token in column["name"] for token in ("quantity", "units")))
    if quantity_column:
        add_kpi("Total Quantity", int(frame[quantity_column].sum()), "count", [quantity_column])

    if revenue_column:
        total_revenue = float(frame[revenue_column].sum())
        add_kpi("Total Revenue", round(total_revenue, 2), "currency", revenue_sources)
        if order_id_column and not orders_column:
            denominator = int(frame[order_id_column].nunique(dropna=True))
        else:
            denominator = float(frame[orders_column].sum()) if orders_column else 0
        if denominator:
            add_kpi("Average Order Value", round(total_revenue / denominator, 2), "currency", revenue_sources + ([orders_column or order_id_column] if orders_column or order_id_column else []))
        if date_column and len(time_series or []) > 1 and time_series[-2]["value"]:
            growth = (time_series[-1]["value"] / time_series[-2]["value"] - 1) * 100
            add_kpi("Revenue Growth", round(growth, 2), "percent", [date_column] + revenue_sources)
    if profit_column:
        profit = float(frame[profit_column].sum())
        add_kpi("Total Profit", round(profit, 2), "currency", [profit_column])
        if revenue_column and frame[revenue_column].sum():
            add_kpi("Profit Margin", round(profit / float(frame[revenue_column].sum()) * 100, 2), "percent", [profit_column, revenue_column])

    attrition_column = _find(schema, lambda column: any(token in column["name"] for token in ("attrition", "turnover")))
    if attrition_column:
        values = frame[attrition_column].dropna().astype(str).str.strip().str.lower()
        attrition_count = int(values.isin({"yes", "true", "1", "left", "attrited", "terminated"}).sum())
        if len(values):
            add_kpi("Attrition Rate", round(attrition_count / len(values) * 100, 2), "percent", [attrition_column])

    return kpis
