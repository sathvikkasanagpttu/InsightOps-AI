from fastapi import APIRouter, Query
from ..deps import get_bundle

router = APIRouter(tags=["Anomalies & Alerts"])


@router.get("/api/datasets/{dataset_id}/anomalies")
def get_dataset_anomalies(dataset_id: str):
    report = get_bundle(dataset_id)["report"]
    # Return detected anomalies from anomaly engine, fallback to alerts
    return report.get("anomalies") or report.get("alerts", [])


@router.get("/api/dataset/alerts")
@router.get("/api/anomalies")
def get_dataset_alerts(dataset_id: str = Query(default="demo-sales")):
    report = get_bundle(dataset_id)["report"]
    return report.get("alerts", [])
