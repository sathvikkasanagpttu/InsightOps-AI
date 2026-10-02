from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..core.auth_middleware import get_optional_user
from ..db.models import AlertRule, DatasetRecord, Report, User, Workspace
from ..db.session import get_db

router = APIRouter(prefix="/api/search", tags=["Global Search"])


@router.get("")
def global_search(
    q: str = Query(min_length=1),
    workspace_id: Optional[str] = Query(default=None),
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    search_term = f"%{q.lower()}%"

    # 1. Search Reports
    r_query = db.query(Report).filter(
        (Report.title.ilike(search_term)) | (Report.description.ilike(search_term))
    )
    if workspace_id:
        r_query = r_query.filter(Report.workspace_id == workspace_id)
    reports = r_query.limit(10).all()

    # 2. Search Datasets
    d_query = db.query(DatasetRecord).filter(
        (DatasetRecord.name.ilike(search_term)) | (DatasetRecord.filename.ilike(search_term)) | (DatasetRecord.dataset_type.ilike(search_term))
    )
    if workspace_id:
        d_query = d_query.filter(DatasetRecord.workspace_id == workspace_id)
    datasets = d_query.limit(10).all()

    # 3. Search Workspaces
    w_query = db.query(Workspace).filter(
        (Workspace.name.ilike(search_term)) | (Workspace.description.ilike(search_term))
    )
    workspaces = w_query.limit(5).all()

    # 4. Search Alerts
    a_query = db.query(AlertRule).filter(
        (AlertRule.name.ilike(search_term)) | (AlertRule.metric_column.ilike(search_term))
    )
    if workspace_id:
        a_query = a_query.filter(AlertRule.workspace_id == workspace_id)
    alerts = a_query.limit(5).all()

    return {
        "query": q,
        "results": {
            "reports": [
                {"id": r.id, "title": r.title, "workspace_id": r.workspace_id, "dataset_id": r.dataset_id}
                for r in reports
            ],
            "datasets": [
                {"id": d.id, "name": d.name, "filename": d.filename, "rows": d.rows_count, "type": d.dataset_type}
                for d in datasets
            ],
            "workspaces": [
                {"id": w.id, "name": w.name, "description": w.description}
                for w in workspaces
            ],
            "alerts": [
                {"id": a.id, "name": a.name, "severity": a.severity, "metric": a.metric_column}
                for a in alerts
            ]
        },
        "total_matches": len(reports) + len(datasets) + len(workspaces) + len(alerts)
    }
