from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.auth_middleware import get_optional_user
from ..db.models import AnomalyRecord, User
from ..db.session import get_db
from ..deps import get_bundle

router = APIRouter(tags=["Anomalies & Alerts"])


class AnomalyStatusUpdateRequest(BaseModel):
    status: str  # open, investigating, resolved, dismissed
    resolution_notes: Optional[str] = None


@router.get("/api/datasets/{dataset_id}/anomalies")
def get_dataset_anomalies(dataset_id: str):
    report = get_bundle(dataset_id)["report"]
    return report.get("anomalies") or report.get("alerts", [])


@router.get("/api/dataset/alerts")
@router.get("/api/anomalies")
def get_dataset_alerts(dataset_id: str = Query(default="demo-sales")):
    report = get_bundle(dataset_id)["report"]
    return report.get("anomalies") or report.get("alerts", [])


@router.get("/api/anomalies/tracked")
def get_tracked_anomalies(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    dataset_id: Optional[str] = "demo-sales",
    db: Session = Depends(get_db)
):
    """
    Retrieves persistently tracked anomalies with workflow status (Open, Investigating, Resolved, Dismissed).
    Auto-seeds from detected anomalies if table is empty for dataset.
    """
    query = db.query(AnomalyRecord)
    if dataset_id:
        query = query.filter(AnomalyRecord.dataset_id == dataset_id)
    if status:
        query = query.filter(AnomalyRecord.status == status)
    if severity:
        query = query.filter(AnomalyRecord.severity == severity)

    records = query.order_by(AnomalyRecord.created_at.desc()).all()
    
    # If no records exist in DB yet, auto-populate from active dataset anomaly detector
    if not records and dataset_id:
        try:
            bundle = get_bundle(dataset_id)
            detected = bundle["report"].get("anomalies", [])
            for anom in detected:
                rec = AnomalyRecord(
                    id=anom.get("id"),
                    workspace_id="default-workspace",
                    dataset_id=dataset_id,
                    metric_column=anom.get("metric", "metric"),
                    period=str(anom.get("period", "Current")),
                    observed_value=float(anom.get("observed", 0.0)),
                    expected_range_lower=anom.get("expected_range", [0, 0])[0] if anom.get("expected_range") else None,
                    expected_range_upper=anom.get("expected_range", [0, 0])[1] if anom.get("expected_range") else None,
                    deviation_score=float(anom.get("deviation_score", 2.0)),
                    severity=anom.get("severity", "medium"),
                    algorithm=anom.get("algorithm", "z_score"),
                    explanation=anom.get("explanation", anom.get("detail", "Statistical deviation")),
                    status="open"
                )
                db.add(rec)
            db.commit()
            records = db.query(AnomalyRecord).filter(AnomalyRecord.dataset_id == dataset_id).all()
        except Exception:
            db.rollback()

    return [
        {
            "id": r.id,
            "metric": r.metric_column,
            "period": r.period,
            "observed": r.observed_value,
            "expected_range": [r.expected_range_lower, r.expected_range_upper],
            "deviation_score": r.deviation_score,
            "severity": r.severity,
            "algorithm": r.algorithm,
            "explanation": r.explanation,
            "status": r.status,
            "resolved_by": r.resolved_by,
            "resolution_notes": r.resolution_notes,
            "created_at": r.created_at.isoformat()
        }
        for r in records
    ]


@router.patch("/api/anomalies/{anomaly_id}/status")
def update_anomaly_status(
    anomaly_id: str,
    req: AnomalyStatusUpdateRequest,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    Updates the operational lifecycle status of an anomaly (e.g. Investigating, Resolved, Dismissed).
    """
    rec = db.query(AnomalyRecord).filter(AnomalyRecord.id == anomaly_id).first()
    if not rec:
        # Create record on demand if it was an in-memory anomaly ID
        rec = AnomalyRecord(
            id=anomaly_id,
            workspace_id="default-workspace",
            dataset_id="demo-sales",
            metric_column="Metric",
            period="Historical",
            observed_value=0.0,
            deviation_score=2.0,
            severity="medium",
            algorithm="z_score",
            explanation="Tracked anomaly incident",
            status=req.status,
            resolved_by=user.email if user else "Analyst",
            resolution_notes=req.resolution_notes
        )
        db.add(rec)
    else:
        rec.status = req.status
        rec.resolved_by = user.email if user else "Analyst"
        if req.resolution_notes:
            rec.resolution_notes = req.resolution_notes

    db.commit()
    return {
        "id": rec.id,
        "status": rec.status,
        "resolved_by": rec.resolved_by,
        "resolution_notes": rec.resolution_notes,
        "message": f"Anomaly status updated to '{rec.status}'"
    }
