from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..dataset_engine import generate_answer
from ..deps import get_bundle
from ..schemas.analyst import AnalystQuestion, PathAnalystQuestion
from ..services.command_center import generate_executive_command_center
from ..services.executive_summary import generate_executive_summary
from ..services.nl2sql_engine import GovernedNL2SQLEngine, SafeQueryValidationError
from ..services.quality_center import perform_deep_data_quality_analysis

router = APIRouter(tags=["Analysis & AI Analyst"])


class SqlQueryRequest(BaseModel):
    dataset_id: Optional[str] = "demo-sales"
    question: Optional[str] = None
    sql: Optional[str] = None


def _kpi_value(report: dict, label: str):
    return next((item["value"] for item in report["kpis"] if item["label"] == label), 0)


@router.post("/api/datasets/{dataset_id}/clean")
def clean_dataset(dataset_id: str):
    report = get_bundle(dataset_id)["report"]
    return {
        "dataset_id": dataset_id,
        "cleaning_report": report["cleaning_report"],
        "quality": report["quality"]
    }


@router.post("/api/analyst/ask")
def analyst_ask(request: AnalystQuestion):
    bundle = get_bundle(request.dataset_id)
    return generate_answer(bundle["frame"], bundle["report"], request.question)


@router.post("/api/datasets/{dataset_id}/ask")
def ask_dataset(dataset_id: str, request: PathAnalystQuestion):
    bundle = get_bundle(dataset_id)
    return generate_answer(bundle["frame"], bundle["report"], request.question)


@router.post("/api/analyst/sql-query")
def execute_sql_analyst(req: SqlQueryRequest):
    """
    Executes a governed natural language to SQL query or validates and executes
    custom user SQL safely on the in-memory dataset table.
    """
    ds_id = req.dataset_id or "demo-sales"
    bundle = get_bundle(ds_id)
    try:
        result = GovernedNL2SQLEngine.execute_governed_query(
            bundle["frame"],
            sql_query=req.sql,
            natural_language_question=req.question
        )
        return result
    except SafeQueryValidationError as sqe:
        raise HTTPException(status_code=400, detail=f"Safe SQL Violation: {str(sqe)}")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/analysis/executive-summary")
def get_executive_summary(dataset_id: str = Query(default="demo-sales")):
    """
    Generates verified C-suite executive briefing with headline, performance metrics,
    risk radar, and actionable recommendations.
    """
    bundle = get_bundle(dataset_id)
    rep = bundle["report"]
    return generate_executive_summary(
        bundle["frame"],
        rep,
        rep.get("kpis", []),
        rep.get("anomalies", []),
        rep.get("forecast")
    )


@router.get("/api/datasets/{dataset_id}/executive-summary")
def get_dataset_executive_summary(dataset_id: str):
    bundle = get_bundle(dataset_id)
    rep = bundle["report"]
    return generate_executive_summary(
        bundle["frame"],
        rep,
        rep.get("kpis", []),
        rep.get("anomalies", []),
        rep.get("forecast")
    )


@router.get("/api/analysis/command-center")
def get_command_center(dataset_id: str = Query(default="demo-sales")):
    """
    Computes real-time executive command center with configurable KPI cards,
    targets, benchmarks, and sparklines.
    """
    bundle = get_bundle(dataset_id)
    rep = bundle["report"]
    return generate_executive_command_center(
        bundle["frame"],
        rep,
        rep.get("kpis", []),
        rep.get("date_column"),
        rep.get("revenue_column")
    )


@router.get("/api/datasets/{dataset_id}/command-center")
def get_dataset_command_center(dataset_id: str):
    bundle = get_bundle(dataset_id)
    rep = bundle["report"]
    return generate_executive_command_center(
        bundle["frame"],
        rep,
        rep.get("kpis", []),
        rep.get("date_column"),
        rep.get("revenue_column")
    )


@router.get("/api/quality/deep-analysis")
def get_deep_quality_analysis(dataset_id: str = Query(default="demo-sales")):
    """
    Comprehensive Data Quality Center analysis covering drift, missingness,
    duplicates, and multi-dimensional scores.
    """
    bundle = get_bundle(dataset_id)
    return perform_deep_data_quality_analysis(bundle["frame"])


@router.get("/api/datasets/{dataset_id}/quality-analysis")
def get_dataset_deep_quality_analysis(dataset_id: str):
    bundle = get_bundle(dataset_id)
    return perform_deep_data_quality_analysis(bundle["frame"])



@router.get("/api/ask")
def ask(q: str, dataset_id: str = Query(default="demo-sales")):
    bundle = get_bundle(dataset_id)
    return generate_answer(bundle["frame"], bundle["report"], q)


@router.get("/api/overview")
def overview(dataset_id: str = Query(default="demo-sales")):
    report = get_bundle(dataset_id)["report"]
    return {
        "analysis_mode": report["analysis_mode"],
        "dataset_type": report["dataset_type"],
        "revenue": _kpi_value(report, "Total Revenue"),
        "orders": _kpi_value(report, "Total Orders"),
        "customers": _kpi_value(report, "Unique Contacts"),
        "profit": _kpi_value(report, "Total Profit"),
        "growth": 0,
        "aov": _kpi_value(report, "Average Order Value"),
        "margin": _kpi_value(report, "Profit Margin"),
        "records": report["rows"],
        "columns": report["column_count"],
        "quality_score": report["quality_score"]
    }
