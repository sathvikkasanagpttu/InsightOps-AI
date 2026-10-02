from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.auth_middleware import get_optional_user
from ..db.models import ActivityLog, User
from ..db.session import get_db

router = APIRouter(prefix="/api/activity", tags=["Audit & Activity Logs"])


class LogActionRequest(BaseModel):
    workspace_id: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    description: str


@router.get("")
def list_activity_logs(
    workspace_id: Optional[str] = Query(default=None),
    resource_type: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    query = db.query(ActivityLog)
    if workspace_id:
        query = query.filter(ActivityLog.workspace_id == workspace_id)
    if resource_type:
        query = query.filter(ActivityLog.resource_type == resource_type)

    logs = query.order_by(ActivityLog.created_at.desc()).limit(limit).all()
    results = []
    for l in logs:
        u = db.query(User).filter(User.id == l.user_id).first() if l.user_id else None
        results.append({
            "id": l.id,
            "action": l.action,
            "resource_type": l.resource_type,
            "resource_id": l.resource_id,
            "description": l.description,
            "user_id": l.user_id,
            "user_name": u.full_name if u else "System",
            "user_email": u.email if u else "system@insightops.ai",
            "created_at": l.created_at.isoformat()
        })
    return results


@router.post("")
def record_activity_log(
    req: LogActionRequest,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    log = ActivityLog(
        user_id=user.id if user else None,
        workspace_id=req.workspace_id,
        action=req.action,
        resource_type=req.resource_type,
        resource_id=req.resource_id,
        description=req.description
    )
    db.add(log)
    db.commit()
    return {"message": "Activity recorded successfully."}
