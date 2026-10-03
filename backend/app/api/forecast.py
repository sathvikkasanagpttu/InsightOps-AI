from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from ..deps import get_bundle
from ..services.forecast_engine import generate_forecast

router = APIRouter(tags=["Forecasting"])


class ForecastRequest(BaseModel):
    dataset_id: str = "demo-sales"
    target_column: Optional[str] = None
    date_column: Optional[str] = None
    periods: int = 3


@router.get("/api/datasets/{dataset_id}/forecast")
def get_dataset_forecast_by_id(dataset_id: str):
    return get_bundle(dataset_id)["report"]["forecast"]


@router.get("/api/dataset/forecast")
@router.get("/api/forecast")
def get_dataset_forecast(dataset_id: str = Query(default="demo-sales")):
    return get_bundle(dataset_id)["report"]["forecast"]


@router.post("/api/forecast/multivariate")
@router.post("/api/forecast")
def compute_multivariate_forecast(req: ForecastRequest):
    bundle = get_bundle(req.dataset_id)
    report = bundle["report"]
    frame = bundle["frame"]

    date_col = req.date_column or report.get("forecast", {}).get("source_columns", [None])[0]
    if not date_col:
        # Auto-detect date column from schema
        for c in report.get("schema", []):
            if c.get("inferred_type") == "datetime":
                date_col = c.get("name")
                break

    target_col = req.target_column or report.get("forecast", {}).get("metric")
    if not target_col:
        for c in report.get("schema", []):
            if c.get("inferred_type") in ["integer", "float"]:
                target_col = c.get("name")
                break

    result = generate_forecast(
        frame=frame,
        schema=report.get("schema", []),
        revenue_column=target_col,
        date_column=date_col
    )
    return result

