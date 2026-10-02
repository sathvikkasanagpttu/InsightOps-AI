from fastapi import APIRouter, Query
from ..deps import get_bundle

router = APIRouter(tags=["Visualizations"])


@router.get("/api/datasets/{dataset_id}/visualizations")
def get_dataset_visualizations_by_id(dataset_id: str):
    return get_bundle(dataset_id)["report"]["charts"]


@router.get("/api/dataset/charts")
def get_dataset_charts(dataset_id: str = Query(default="demo-sales")):
    return get_bundle(dataset_id)["report"]["charts"]


@router.get("/api/trends")
def trends(dataset_id: str = Query(default="demo-sales")):
    return get_bundle(dataset_id)["report"]["time_series"]


@router.get("/api/categories")
def categories(dataset_id: str = Query(default="demo-sales")):
    return [
        item for item in get_bundle(dataset_id)["report"]["dimensions"]
        if item["semantic_type"] in {"category", "status", "source", "delivery_mode"}
    ]


@router.get("/api/regions")
def regions(dataset_id: str = Query(default="demo-sales")):
    return [
        item for item in get_bundle(dataset_id)["report"]["dimensions"]
        if item["semantic_type"] in {"region", "location"}
    ]
