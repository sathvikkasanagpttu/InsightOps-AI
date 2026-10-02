from fastapi import APIRouter, Query
from ..deps import get_bundle

router = APIRouter(tags=["Insights & KPIs"])


@router.get("/api/datasets/{dataset_id}/insights")
def get_dataset_insights_by_id(dataset_id: str):
    return get_bundle(dataset_id)["report"]["insights"]


@router.get("/api/dataset/insights")
def get_dataset_insights(dataset_id: str = Query(default="demo-sales")):
    return get_bundle(dataset_id)["report"]["insights"]


@router.get("/api/datasets/{dataset_id}/kpis")
def get_dataset_kpis_by_id(dataset_id: str):
    report = get_bundle(dataset_id)["report"]
    return {
        "dataset_id": dataset_id,
        "dataset_type": report["dataset_type"],
        "kpis": report["kpis"]
    }


@router.get("/api/dataset/kpis")
def get_dataset_kpis(dataset_id: str = Query(default="demo-sales")):
    report = get_bundle(dataset_id)["report"]
    return {
        "dataset_id": dataset_id,
        "dataset_type": report["dataset_type"],
        "kpis": report["kpis"]
    }
