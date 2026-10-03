import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import pandas as pd


PII_PATTERNS = {
    "email": {
        "regex": re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"),
        "severity": "High",
        "category": "Direct PII",
        "recommended_action": "Partial Masking / Pseudonymization"
    },
    "phone": {
        "regex": re.compile(r"(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}"),
        "severity": "High",
        "category": "Direct PII",
        "recommended_action": "Mask Last 4 Digits"
    },
    "credit_card": {
        "regex": re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b"),
        "severity": "Critical",
        "category": "PCI Financial Data",
        "recommended_action": "Cryptographic Tokenization / Redaction"
    },
    "ssn": {
        "regex": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
        "severity": "Critical",
        "category": "National Identifier",
        "recommended_action": "Immediate Hashing & Zero-Knowledge Salt"
    },
    "ip_address": {
        "regex": re.compile(r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b"),
        "severity": "Medium",
        "category": "Network Telemetry",
        "recommended_action": "Anonymize Last Octet (/24)"
    }
}


def scan_sensitive_columns(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Performs deterministic privacy and compliance scan across all columns.
    """
    findings = []
    total_sensitive_cells = 0

    for col in df.columns:
        col_str = str(col).lower()
        col_series = df[col].astype(str)
        sample_values = col_series.dropna().head(100).tolist()
        
        matched_category = None
        matched_severity = None
        matched_action = None
        detected_count = 0

        # 1. Header Name Heuristics
        if any(k in col_str for k in ["email", "e_mail", "mail"]):
            matched_category = "Direct PII (Email)"
            matched_severity = "High"
            matched_action = "Mask domain or pseudonymize with HMAC-SHA256"
        elif any(k in col_str for k in ["phone", "mobile", "cell", "telephone", "contact_no"]):
            matched_category = "Direct PII (Phone)"
            matched_severity = "High"
            matched_action = "Mask phone number (***-***-1234)"
        elif any(k in col_str for k in ["ssn", "social_security", "national_id", "passport"]):
            matched_category = "National ID / SSN"
            matched_severity = "Critical"
            matched_action = "Strict Redaction / Hardware Vault Tokenization"
        elif any(k in col_str for k in ["card_number", "credit_card", "pan", "cvv", "iban", "bank_account"]):
            matched_category = "PCI Financial Data"
            matched_severity = "Critical"
            matched_action = "PCI-DSS Tokenization & Restrict Access to Vault"
        elif any(k in col_str for k in ["ip_address", "client_ip", "user_ip"]):
            matched_category = "Network Identifier (IP)"
            matched_severity = "Medium"
            matched_action = "Mask last octet (/24 subnet mask)"

        # 2. Content Pattern Regex Scan
        for pattern_name, meta in PII_PATTERNS.items():
            matches = sum(1 for v in sample_values if meta["regex"].search(str(v)))
            if matches > 0:
                detected_count = matches
                if not matched_category or meta["severity"] == "Critical":
                    matched_category = meta["category"]
                    matched_severity = meta["severity"]
                    matched_action = meta["recommended_action"]
                break

        if matched_category:
            findings.append({
                "column_name": col,
                "detected_type": matched_category,
                "severity": matched_severity,
                "sample_masked": [str(v)[:2] + "***" + str(v)[-2:] if len(str(v)) > 4 else "***" for v in sample_values[:3]],
                "recommended_action": matched_action,
                "governance_status": "Flagged for Compliance Review"
            })
            total_sensitive_cells += detected_count

    compliance_score = max(0, 100 - (len(findings) * 15))
    compliance_status = "Compliant" if len(findings) == 0 else ("Attention Required" if compliance_score > 60 else "High Risk")

    return {
        "total_columns_scanned": len(df.columns),
        "sensitive_columns_count": len(findings),
        "compliance_score": compliance_score,
        "compliance_status": compliance_status,
        "findings": findings,
        "gdpr_ccpa_readiness": "Ready" if len(findings) == 0 else "Review Recommended"
    }


def generate_dataset_lineage_graph(
    dataset_id: str,
    filename: str,
    metadata: Dict[str, Any],
    report: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Generates an enterprise end-to-end data lineage DAG:
    Source File -> Ingestion -> Cleaning & Transformation -> Semantic Modeling -> Downstream BI Consumers.
    """
    created_at = metadata.get("created_at") or datetime.now(timezone.utc).isoformat()
    rows = report.get("rows", 0)
    cols = report.get("column_count", 0)
    transform_history = metadata.get("transformation_history", [])

    nodes = [
        {
            "id": "node-source",
            "type": "source",
            "title": f"Source File: {filename}",
            "description": f"Raw {report.get('file_type', 'CSV')} payload ingested via secure endpoint.",
            "status": "Verified",
            "metrics": f"{report.get('file_size', 4096):,} bytes",
            "timestamp": created_at,
            "color": "#3b82f6"
        },
        {
            "id": "node-ingest",
            "type": "pipeline",
            "title": "Ingestion & Auto-Profiling",
            "description": f"Schema parsing, delimiter detection ({metadata.get('delimiter', 'comma')}), and memory allocation.",
            "status": "Completed",
            "metrics": f"{rows:,} rows × {cols} cols",
            "timestamp": created_at,
            "color": "#06b6d4"
        },
        {
            "id": "node-clean",
            "type": "transform",
            "title": "Data Quality & Cleaning",
            "description": f"Quality scorecard ({report.get('quality_score', 100)}/100). {len(transform_history)} active transformation steps applied.",
            "status": "Active",
            "metrics": f"Score: {report.get('quality_score', 100)}%",
            "timestamp": metadata.get("updated_at") or created_at,
            "color": "#10b981"
        },
        {
            "id": "node-semantic",
            "type": "model",
            "title": "Semantic BI & Metric Engine",
            "description": f"Identified primary metrics ({report.get('revenue_column') or 'Auto-detected'}), date dimension, and category hierarchies.",
            "status": "Governed",
            "metrics": f"{len(report.get('kpis', []))} Core KPIs",
            "timestamp": metadata.get("updated_at") or created_at,
            "color": "#8b5cf6"
        },
        {
            "id": "node-consumer-command",
            "type": "consumer",
            "title": "Executive Command Center",
            "description": "Real-time telemetry, benchmark tracking, and multi-model forecast tournament.",
            "status": "Live",
            "metrics": "Continuous Sync",
            "timestamp": metadata.get("updated_at") or created_at,
            "color": "#f59e0b"
        },
        {
            "id": "node-consumer-analyst",
            "type": "consumer",
            "title": "Governed AI Analyst",
            "description": "NL-to-SQL querying, verified evidence citations, and conversational threads.",
            "status": "Active",
            "metrics": "Safe SQL Sandbox",
            "timestamp": metadata.get("updated_at") or created_at,
            "color": "#ec4899"
        },
        {
            "id": "node-consumer-simulator",
            "type": "consumer",
            "title": "What-If Decision Simulator",
            "description": "Elasticity modeling, scenario planning, and variance sensitivity sweeps.",
            "status": "Ready",
            "metrics": "Parametric Engine",
            "timestamp": metadata.get("updated_at") or created_at,
            "color": "#14b8a6"
        }
    ]

    edges = [
        {"from": "node-source", "to": "node-ingest", "label": "Upload Stream"},
        {"from": "node-ingest", "to": "node-clean", "label": "Sanitize & Validate"},
        {"from": "node-clean", "to": "node-semantic", "label": "Extract Dimensional Model"},
        {"from": "node-semantic", "to": "node-consumer-command", "label": "Telemetry Feed"},
        {"from": "node-semantic", "to": "node-consumer-analyst", "label": "In-Memory Schema"},
        {"from": "node-semantic", "to": "node-consumer-simulator", "label": "Baseline Metrics"}
    ]

    return {
        "dataset_id": dataset_id,
        "dataset_name": filename,
        "nodes": nodes,
        "edges": edges,
        "total_nodes": len(nodes),
        "total_edges": len(edges),
        "health": "Optimal"
    }
