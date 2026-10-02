from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.auth_middleware import check_workspace_permission, get_current_user, get_optional_user
from ..db.models import ActivityLog, AlertRule, User, Workspace
from ..db.session import get_db
from ..deps import get_bundle

router = APIRouter(prefix="/api/alerts", tags=["Alerts Center"])


class CreateAlertRequest(BaseModel):
    workspace_id: str
    dataset_id: Optional[str] = None
    name: str = Field(min_length=2, max_length=255)
    alert_type: str = Field(default="threshold", description="threshold, anomaly, kpi_change, scheduled")
    metric_column: str
    condition: str = Field(default="gt", description="gt, lt, anomaly_detected, pct_change")
    threshold_value: Optional[float] = None
    severity: str = Field(default="medium", description="low, medium, high, critical")
    delivery_channel: str = Field(default="in_app", description="in_app, email, both")
    schedule: str = Field(default="realtime", description="realtime, daily, weekly, monthly")


class UpdateAlertRequest(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    threshold_value: Optional[float] = None
    severity: Optional[str] = None
    delivery_channel: Optional[str] = None
    schedule: Optional[str] = None


@router.get("")
def list_alert_rules(
    workspace_id: Optional[str] = Query(default=None),
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    query = db.query(AlertRule)
    if workspace_id:
        query = query.filter(AlertRule.workspace_id == workspace_id)
    alerts = query.order_by(AlertRule.created_at.desc()).all()

    return [
        {
            "id": a.id,
            "workspace_id": a.workspace_id,
            "dataset_id": a.dataset_id,
            "name": a.name,
            "alert_type": a.alert_type,
            "metric_column": a.metric_column,
            "condition": a.condition,
            "threshold_value": a.threshold_value,
            "severity": a.severity,
            "is_active": a.is_active,
            "delivery_channel": a.delivery_channel,
            "schedule": a.schedule,
            "last_triggered_at": a.last_triggered_at.isoformat() if a.last_triggered_at else None,
            "created_at": a.created_at.isoformat()
        }
        for a in alerts
    ]


@router.post("")
def create_alert_rule(
    req: CreateAlertRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_workspace_permission(req.workspace_id, user, db, ["Owner", "Admin", "Analyst"])
    rule = AlertRule(
        workspace_id=req.workspace_id,
        dataset_id=req.dataset_id,
        user_id=user.id,
        name=req.name,
        alert_type=req.alert_type,
        metric_column=req.metric_column,
        condition=req.condition,
        threshold_value=req.threshold_value,
        severity=req.severity,
        delivery_channel=req.delivery_channel,
        schedule=req.schedule,
        is_active=True
    )
    db.add(rule)
    db.flush()

    db.add(ActivityLog(
        user_id=user.id,
        workspace_id=req.workspace_id,
        action="alert_create",
        resource_type="alert",
        resource_id=rule.id,
        description=f"Created alert rule '{rule.name}' on {rule.metric_column} ({rule.severity})."
    ))
    db.commit()

    return {
        "id": rule.id,
        "name": rule.name,
        "is_active": rule.is_active,
        "created_at": rule.created_at.isoformat()
    }


@router.put("/{alert_id}")
def update_alert_rule(
    alert_id: str,
    req: UpdateAlertRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rule = db.query(AlertRule).filter(AlertRule.id == alert_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    check_workspace_permission(rule.workspace_id, user, db, ["Owner", "Admin", "Analyst"])

    if req.name is not None:
        rule.name = req.name
    if req.is_active is not None:
        rule.is_active = req.is_active
    if req.threshold_value is not None:
        rule.threshold_value = req.threshold_value
    if req.severity is not None:
        rule.severity = req.severity
    if req.delivery_channel is not None:
        rule.delivery_channel = req.delivery_channel
    if req.schedule is not None:
        rule.schedule = req.schedule

    db.commit()
    return {"message": "Alert rule updated successfully."}


@router.post("/{alert_id}/toggle")
def toggle_alert_rule(
    alert_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rule = db.query(AlertRule).filter(AlertRule.id == alert_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    check_workspace_permission(rule.workspace_id, user, db, ["Owner", "Admin", "Analyst"])
    rule.is_active = not rule.is_active
    db.commit()
    return {"id": rule.id, "is_active": rule.is_active}


@router.delete("/{alert_id}")
def delete_alert_rule(
    alert_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rule = db.query(AlertRule).filter(AlertRule.id == alert_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    check_workspace_permission(rule.workspace_id, user, db, ["Owner", "Admin", "Analyst"])
    db.delete(rule)
    db.commit()
    return {"message": "Alert rule deleted successfully."}


@router.get("/notifications")
def get_triggered_alerts_feed(
    dataset_id: str = Query(default="demo-sales"),
    db: Session = Depends(get_db)
):
    # Evaluates active rules against the dataset
    notifications = []
    try:
        bundle = get_bundle(dataset_id)
        report = bundle["report"]
        kpis = {k["label"].lower(): k["value"] for k in report.get("kpis", [])}
        anomalies = report.get("anomalies", [])

        rules = db.query(AlertRule).filter(AlertRule.is_active == True).all()
        for r in rules:
            triggered = False
            message = ""

            if r.alert_type == "anomaly" and anomalies:
                triggered = True
                message = f"Detected {len(anomalies)} statistical anomalies matching '{r.metric_column}'."
            elif r.condition == "gt" and r.threshold_value is not None:
                # Check if any metric exceeds threshold
                for k_name, k_val in kpis.items():
                    if r.metric_column.lower() in k_name and k_val > r.threshold_value:
                        triggered = True
                        message = f"Metric '{k_name}' value ({k_val:,.2f}) exceeded threshold ({r.threshold_value:,.2f})."
                        break
            elif r.condition == "lt" and r.threshold_value is not None:
                # Check if quality or metric is below threshold
                if r.metric_column == "quality_score" and report.get("quality_score", 100) < r.threshold_value:
                    triggered = True
                    message = f"Dataset quality score dropped to {report.get('quality_score')}%, below minimum threshold of {r.threshold_value}%."

            if triggered:
                notifications.append({
                    "rule_id": r.id,
                    "rule_name": r.name,
                    "severity": r.severity,
                    "channel": r.delivery_channel,
                    "message": message,
                    "triggered_at": datetime.utcnow().isoformat()
                })
    except Exception:
        pass

    return notifications
