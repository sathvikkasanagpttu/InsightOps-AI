from fastapi import APIRouter, HTTPException, Query
from ..dataset_engine import generate_answer
from ..deps import get_bundle
from ..schemas.analyst import AnalystQuestion, PathAnalystQuestion

router = APIRouter(tags=["Analysis & AI Analyst"])


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
