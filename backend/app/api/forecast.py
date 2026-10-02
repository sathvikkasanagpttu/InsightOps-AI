from fastapi import APIRouter, Query
from ..deps import get_bundle

router = APIRouter(tags=["Forecasting"])


@router.get("/api/datasets/{dataset_id}/forecast")
def get_dataset_forecast_by_id(dataset_id: str):
    return get_bundle(dataset_id)["report"]["forecast"]


@router.get("/api/dataset/forecast")
@router.get("/api/forecast")
def get_dataset_forecast(dataset_id: str = Query(default="demo-sales")):
    return get_bundle(dataset_id)["report"]["forecast"]
