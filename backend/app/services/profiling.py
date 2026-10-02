import re
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np
import pandas as pd

COLUMN_ALIASES: Dict[str, Set[str]] = {
    "date": {
        "date", "created", "created_at", "timestamp", "order_date",
        "transaction_date", "sale_date", "sales_date", "invoice_date",
        "hire_date", "admitted_date", "updated_at", "start_date", "end_date"
    },
    "revenue": {
        "revenue", "sales", "sale_amount", "sales_amount", "total_sales",
        "total_revenue", "net_sales", "amount", "total", "price", "value"
    },
    "customer": {"customer", "customers", "client", "contact", "patient"},
    "region": {"region", "area", "zone", "territory", "location", "state", "city", "country"},
    "category": {
        "category", "type", "product", "department", "gender", "condition",
        "treatment", "product_category", "segment", "product_type", "item_category"
    },
    "status": {"status", "order_status", "lead_status", "outcome", "attrition"},
    "identifier": {
        "id", "product_id", "order_id", "record_id", "lead_id",
        "employee_id", "customer_id", "client_id", "contact_id", "patient_id"
    },
    "email": {"email", "email_address", "e_mail"},
    "phone": {"phone", "phone_number", "mobile", "mobile_number", "telephone", "contact_number"},
    "person": {"person", "name", "full_name", "sales_agent", "agent", "employee", "owner", "assignee"},
    "source": {"source", "channel", "lead_source", "acquisition_source"},
    "delivery_mode": {"delivery_mode", "delivery", "shipping_method", "fulfillment_method"},
    "percentage": {"percentage", "percent", "rate", "margin", "conversion_rate", "attrition_rate", "recovery_rate"},
    "currency": {
        "profit", "net_profit", "gross_profit", "earnings", "salary", "cost",
        "expense", "expenses", "income", "cash_flow", "inventory_value", "price"
    },
    "boolean": {"is_active", "active", "enabled", "verified", "delivered", "attrition", "flag"},
}

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PHONE_PATTERN = re.compile(r"^\+?[0-9() .-]{7,20}$")
PII_SEMANTICS = {"email", "phone"}
DIMENSION_SEMANTICS = {"category", "status", "source", "region", "location", "delivery_mode", "person", "channel"}


def normalize_name(value: object) -> str:
    name = str(value).strip().lower()
    name = re.sub(r"[^a-z0-9]+", "_", name).strip("_")
    return name or "column"


def _name_semantic(name: str) -> Tuple[Optional[str], float]:
    normalized = normalize_name(name)
    if normalized in {
        "customers", "customer_count", "number_of_customers", "num_customers",
        "orders", "order_count", "quantity", "units", "count", "age",
        "experience", "tenure", "score", "population", "headcount"
    }:
        return "numeric", 0.84

    for semantic in (
        "email", "phone", "date", "revenue", "customer", "region",
        "category", "status", "identifier", "person", "source",
        "delivery_mode", "percentage", "currency", "boolean"
    ):
        aliases = COLUMN_ALIASES[semantic]
        if normalized in aliases:
            return ("currency" if semantic == "revenue" else semantic), 0.96

    if any(token in normalized for token in ("email", "e_mail")):
        return "email", 0.9
    if any(token in normalized for token in ("mobile", "phone", "telephone")):
        return "phone", 0.9
    if any(token in normalized for token in ("date", "time", "created", "timestamp", "admitted", "hired")):
        return "date", 0.88
    if any(token in normalized for token in ("revenue", "sales", "amount", "price", "profit", "cost", "salary", "value", "income", "expense", "cash_flow")):
        return "currency", 0.84
    if "percent" in normalized or "rate" in normalized or "margin" in normalized:
        return "percentage", 0.82
    if normalized.endswith("_id") or normalized == "id" or normalized.endswith("_key"):
        return "identifier", 0.9
    if any(token in normalized for token in ("agent", "employee", "owner", "assignee", "person", "full_name")):
        return "person", 0.84
    if any(token in normalized for token in ("region", "location", "country", "state", "city", "zone", "territory")):
        return "region", 0.84
    if "status" in normalized or normalized.endswith("_state") or normalized in ("outcome", "attrition"):
        return "status", 0.82
    if any(token in normalized for token in ("source", "channel", "campaign", "medium")):
        return "source", 0.82
    if "delivery" in normalized or "shipping" in normalized or "fulfillment" in normalized:
        return "delivery_mode", 0.82
    if "category" in normalized or "segment" in normalized or "product_type" in normalized:
        return "category", 0.82
    if "customer" in normalized or "client" in normalized or "contact" in normalized:
        return "customer", 0.82
    if normalized.startswith("is_") or normalized.startswith("has_"):
        return "boolean", 0.78

    return None, 0.0


def classify_column(name: str, series: pd.Series) -> Dict[str, Any]:
    non_null = series.dropna()
    values = non_null.astype(str).str.strip()
    named_semantic, named_confidence = _name_semantic(name)

    if named_semantic in PII_SEMANTICS:
        semantic, confidence = named_semantic, named_confidence
    elif named_semantic == "date":
        semantic, confidence = "datetime", named_confidence
    elif named_semantic in {"currency", "percentage", "identifier", "numeric"}:
        semantic, confidence = named_semantic, named_confidence
    elif not values.empty and values.str.contains(EMAIL_PATTERN).mean() >= 0.7:
        semantic, confidence = "email", 0.93
    elif not values.empty and pd.to_datetime(values, errors="coerce", format="mixed").notna().mean() >= 0.85:
        semantic, confidence = "datetime", 0.82
    elif named_semantic in {"customer", "region", "category", "status", "person", "source", "delivery_mode", "boolean"}:
        semantic, confidence = named_semantic, named_confidence
    elif (
        not values.empty
        and values.str.match(PHONE_PATTERN).mean() >= 0.8
        and values.str.replace(r"\D", "", regex=True).str.len().between(7, 15).mean() >= 0.8
    ):
        semantic, confidence = "phone", 0.86
    elif pd.api.types.is_datetime64_any_dtype(series):
        semantic, confidence = "datetime", 0.98
    elif not values.empty and values.str.lower().isin({"true", "false", "yes", "no", "0", "1", "y", "n"}).mean() >= 0.9:
        semantic, confidence = "boolean", 0.85
    elif not values.empty:
        parsed_dates = pd.to_datetime(values, errors="coerce", format="mixed")
        if parsed_dates.notna().mean() >= 0.85:
            semantic, confidence = "datetime", 0.82
        else:
            numeric_values = pd.to_numeric(
                values.str.replace(r"[, $₹€£%]", "", regex=True).str.replace(r"^\((.*)\)$", r"-\1", regex=True),
                errors="coerce"
            )
            if numeric_values.notna().mean() >= 0.85:
                semantic, confidence = "numeric", 0.88
            elif int(non_null.nunique()) <= min(30, max(2, int(len(non_null) * 0.5))):
                semantic, confidence = "category", 0.72
            else:
                semantic, confidence = "text", 0.62
    elif pd.api.types.is_numeric_dtype(series):
        semantic, confidence = "numeric", 0.8
    else:
        semantic, confidence = "unknown", 0.4

    if semantic == "date" and pd.api.types.is_datetime64_any_dtype(series):
        semantic = "datetime"
    elif semantic == "date":
        parsed_dates = pd.to_datetime(non_null, errors="coerce", format="mixed")
        if not non_null.empty and parsed_dates.notna().mean() >= 0.7:
            semantic = "datetime"

    null_percentage = round(float(series.isna().mean() * 100), 2) if len(series) else 0.0
    return {
        "column_name": name,
        "data_type": str(series.dtype),
        "semantic_type": semantic,
        "confidence": round(float(confidence), 2),
        "null_percentage": null_percentage,
        "unique_count": int(series.nunique(dropna=True)),
    }


def mask_value(value: object, semantic: str) -> str:
    text = str(value)
    if semantic == "email":
        if "@" not in text:
            return f"{text[:1]}***"
        local, domain = text.split("@", 1)
        return f"{local[:2]}{'*' * max(2, len(local) - 2)}@{domain}"
    if semantic == "phone":
        digits = re.sub(r"\D", "", text)
        return f"{'*' * max(0, len(digits) - 4)}{digits[-4:]}" if digits else "***"
    return text[:80]


def calculate_numeric_statistics(frame: pd.DataFrame, schema: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    stats = []
    outlier_alerts = []
    for col in schema:
        name = col["name"]
        if col["semantic_type"] not in {"numeric", "currency", "percentage"}:
            continue
        if name not in frame.columns:
            continue
        vals = frame[name].dropna()
        if vals.empty:
            continue
        try:
            numeric_vals = pd.to_numeric(vals, errors="coerce").dropna()
            if numeric_vals.empty:
                continue
            quartiles = numeric_vals.quantile([0.25, 0.5, 0.75])
            q1, q2, q3 = quartiles.loc[0.25], quartiles.loc[0.5], quartiles.loc[0.75]
            iqr = q3 - q1
            outlier_count = 0
            if iqr > 0:
                outlier_count = int(((numeric_vals < q1 - 1.5 * iqr) | (numeric_vals > q3 + 1.5 * iqr)).sum())
                if outlier_count:
                    outlier_alerts.append({
                        "title": f"Potential outliers: {col['original_name']}",
                        "detail": f"{outlier_count} values fall outside the 1.5×IQR range.",
                        "severity": "medium",
                        "source_columns": [name],
                        "outlier_count": outlier_count
                    })

            stats.append({
                "column": name,
                "original_name": col.get("original_name", name),
                "count": int(numeric_vals.size),
                "mean": round(float(numeric_vals.mean()), 3),
                "median": round(float(q2), 3),
                "std": round(float(numeric_vals.std()), 3) if numeric_vals.size > 1 else 0.0,
                "min": float(numeric_vals.min()),
                "q1": round(float(q1), 3),
                "q3": round(float(q3), 3),
                "max": float(numeric_vals.max()),
                "outlier_count": outlier_count
            })
        except Exception:
            continue
    return stats, outlier_alerts


def calculate_quality_report(frame: pd.DataFrame, schema: List[Dict[str, Any]], cleaning: Dict[str, Any]) -> Dict[str, Any]:
    rows, column_count = frame.shape
    cells = max(rows * column_count, 1)
    missing = int(frame.isna().sum().sum())
    duplicates = int(frame.duplicated().sum())
    invalid = sum(cleaning.get("invalid_values_by_column", {}).values())
    typed_columns = [c for c in schema if c["semantic_type"] in {"datetime", "date", "numeric", "currency", "percentage"}]
    typed_nonempty = sum(int(frame[c["name"]].notna().sum()) for c in typed_columns if c["name"] in frame.columns)

    components = {
        "completeness": round(100 * (cells - missing) / cells, 1),
        "uniqueness": round(100 * (rows - duplicates) / max(rows, 1), 1),
        "validity": round(100 * max(0, cells - invalid) / cells, 1),
        "consistency": round(100 * max(0, rows - duplicates - invalid) / max(rows, 1), 1),
        "type_correctness": round(100 * max(0, typed_nonempty) / max(typed_nonempty + invalid, 1), 1),
    }
    score = round(sum(components.values()) / len(components), 1)

    missing_by_column = [
        {
            "column": c["name"],
            "count": int(frame[c["name"]].isna().sum()),
            "percentage": round(float(frame[c["name"]].isna().mean() * 100), 2)
        }
        for c in schema
        if c["name"] in frame.columns and frame[c["name"]].isna().any()
    ]
    invalid_by_column = [
        {"column": col, "count": count}
        for col, count in cleaning.get("invalid_values_by_column", {}).items()
        if count
    ]

    return {
        "overall_score": score,
        "components": components,
        "rows": rows,
        "columns": column_count,
        "missing_values": missing,
        "missing_by_column": missing_by_column,
        "duplicate_rows": duplicates,
        "invalid_values": invalid,
        "invalid_by_column": invalid_by_column,
    }


def classify_dataset_domain(schema: List[Dict[str, Any]]) -> Tuple[str, float, List[str]]:
    semantics = {item["semantic_type"] for item in schema}
    names = {item["name"] for item in schema}
    entities = []

    entity_map = (
        ("customer", "Customers / Contacts"),
        ("identifier", "Product / Record IDs"),
        ("person", "Sales Agents / People"),
        ("region", "Regions / Locations"),
        ("delivery_mode", "Delivery Modes"),
        ("status", "Statuses"),
        ("source", "Sources / Channels"),
        ("datetime", "Creation Date"),
        ("date", "Date"),
    )
    for semantic, label in entity_map:
        if semantic in semantics:
            entities.append(label)

    if {"status", "region"}.issubset(semantics) and ({"source"} & semantics or {"person"} & semantics):
        return "Customer / Lead / Sales Operations", 0.92, entities

    if any("employee" in name for name in names) and ("department" in names or "salary" in names or "attrition" in names):
        entities.extend(l for l in ("Employees", "Departments", "Salary") if l not in entities)
        return "HR / Workforce", 0.90, entities

    if any("patient" in name for name in names) and any(token in " ".join(names) for token in ("treatment", "outcome", "condition", "admitted")):
        entities.extend(l for l in ("Patients", "Treatments", "Outcomes") if l not in entities)
        return "Healthcare", 0.88, entities

    if any("order" in name for name in names) and any("customer" in name for name in names) and any("product" in name for name in names):
        entities.extend(l for l in ("Orders", "Customers", "Products") if l not in entities)
        return "E-commerce", 0.90, entities

    if any(token in " ".join(names) for token in ("income", "expense", "cash_flow", "account")):
        entities.extend(l for l in ("Income", "Expenses", "Cash Flow") if l not in entities)
        return "Finance", 0.88, entities

    if "currency" in semantics and any(token in " ".join(names) for token in ("sales", "revenue", "amount")):
        return "Sales / Revenue", 0.88, entities

    has_inventory_field = any(any(token in name for token in ("stock", "inventory", "sku")) for name in names)
    has_warehouse_field = any("warehouse" in name for name in names) and any(any(token in name for token in ("product", "quantity", "stock", "inventory")) for name in names)
    if has_inventory_field or has_warehouse_field:
        return "Inventory / Operations", 0.84, entities

    return "General Dataset", 0.68, entities
