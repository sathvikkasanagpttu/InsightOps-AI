import json
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.auth_middleware import check_workspace_permission, get_current_user, get_optional_user
from ..db.models import ActivityLog, Report, User, Workspace
from ..db.session import get_db
from ..deps import get_bundle, safe_export_frame

router = APIRouter(tags=["Reports & Exports"])


# ==========================================
# Pydantic Schemas for SaaS Reports
# ==========================================

class CreateReportRequest(BaseModel):
    workspace_id: str
    dataset_id: Optional[str] = None
    title: str = Field(min_length=2, max_length=255)
    description: Optional[str] = None
    pages: List[Dict[str, Any]] = Field(default_factory=list)
    filters: List[Dict[str, Any]] = Field(default_factory=list)
    schedule_frequency: Optional[str] = None  # daily, weekly, monthly


class UpdateReportRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    pages: Optional[List[Dict[str, Any]]] = None
    filters: Optional[List[Dict[str, Any]]] = None
    schedule_frequency: Optional[str] = None


class ShareReportRequest(BaseModel):
    is_shared: bool = True
    share_role: str = Field(default="Viewer", description="Viewer, Editor, Owner")


# ==========================================
# SaaS Reports CRUD & Sharing
# ==========================================

@router.get("/api/reports")
def list_reports(
    workspace_id: Optional[str] = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Report)
    if workspace_id:
        check_workspace_permission(workspace_id, user, db, ["Owner", "Admin", "Analyst", "Viewer"])
        query = query.filter(Report.workspace_id == workspace_id)
    else:
        # User's accessible workspaces
        from ..db.models import WorkspaceMember
        ws_ids = [m.workspace_id for m in db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).all()]
        if ws_ids:
            query = query.filter(Report.workspace_id.in_(ws_ids))
        else:
            return []

    reports = query.order_by(Report.updated_at.desc()).all()
    results = []
    for r in reports:
        pages = json.loads(r.pages_json) if r.pages_json else []
        results.append({
            "id": r.id,
            "workspace_id": r.workspace_id,
            "dataset_id": r.dataset_id,
            "creator_id": r.creator_id,
            "creator_name": r.creator.full_name if r.creator else "Unknown",
            "title": r.title,
            "description": r.description,
            "pages_count": len(pages),
            "schedule_frequency": r.schedule_frequency,
            "is_shared": r.is_shared,
            "share_role": r.share_role,
            "created_at": r.created_at.isoformat(),
            "updated_at": r.updated_at.isoformat()
        })
    return results


@router.post("/api/reports")
def create_report(
    req: CreateReportRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_workspace_permission(req.workspace_id, user, db, ["Owner", "Admin", "Analyst"])
    report = Report(
        workspace_id=req.workspace_id,
        dataset_id=req.dataset_id,
        creator_id=user.id,
        title=req.title,
        description=req.description,
        pages_json=json.dumps(req.pages),
        filters_json=json.dumps(req.filters),
        schedule_frequency=req.schedule_frequency
    )
    db.add(report)
    db.flush()

    db.add(ActivityLog(
        user_id=user.id,
        workspace_id=req.workspace_id,
        action="report_create",
        resource_type="report",
        resource_id=report.id,
        description=f"Created report '{report.title}' with {len(req.pages)} pages."
    ))
    db.commit()

    return {
        "id": report.id,
        "title": report.title,
        "workspace_id": report.workspace_id,
        "dataset_id": report.dataset_id,
        "created_at": report.created_at.isoformat()
    }


@router.get("/api/reports/{report_id}")
def get_report_by_id(
    report_id: str,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # If not shared publicly, check permissions
    if not report.is_shared and user:
        check_workspace_permission(report.workspace_id, user, db, ["Owner", "Admin", "Analyst", "Viewer"])

    return {
        "id": report.id,
        "workspace_id": report.workspace_id,
        "dataset_id": report.dataset_id,
        "creator_id": report.creator_id,
        "creator_name": report.creator.full_name if report.creator else "Unknown",
        "title": report.title,
        "description": report.description,
        "pages": json.loads(report.pages_json) if report.pages_json else [],
        "filters": json.loads(report.filters_json) if report.filters_json else [],
        "schedule_frequency": report.schedule_frequency,
        "is_shared": report.is_shared,
        "share_role": report.share_role,
        "created_at": report.created_at.isoformat(),
        "updated_at": report.updated_at.isoformat()
    }


@router.put("/api/reports/{report_id}")
def update_report(
    report_id: str,
    req: UpdateReportRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    check_workspace_permission(report.workspace_id, user, db, ["Owner", "Admin", "Analyst"])

    if req.title:
        report.title = req.title
    if req.description is not None:
        report.description = req.description
    if req.pages is not None:
        report.pages_json = json.dumps(req.pages)
    if req.filters is not None:
        report.filters_json = json.dumps(req.filters)
    if req.schedule_frequency is not None:
        report.schedule_frequency = req.schedule_frequency

    db.add(ActivityLog(
        user_id=user.id,
        workspace_id=report.workspace_id,
        action="report_update",
        resource_type="report",
        resource_id=report.id,
        description=f"Updated report layout for '{report.title}'."
    ))
    db.commit()
    return {"message": "Report updated successfully."}


@router.post("/api/reports/{report_id}/duplicate")
def duplicate_report(
    report_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    check_workspace_permission(report.workspace_id, user, db, ["Owner", "Admin", "Analyst"])

    cloned = Report(
        workspace_id=report.workspace_id,
        dataset_id=report.dataset_id,
        creator_id=user.id,
        title=f"{report.title} (Copy)",
        description=report.description,
        pages_json=report.pages_json,
        filters_json=report.filters_json,
        schedule_frequency=report.schedule_frequency,
        is_shared=False
    )
    db.add(cloned)
    db.flush()

    db.add(ActivityLog(
        user_id=user.id,
        workspace_id=report.workspace_id,
        action="report_duplicate",
        resource_type="report",
        resource_id=cloned.id,
        description=f"Duplicated report '{report.title}' to '{cloned.title}'."
    ))
    db.commit()
    return {
        "id": cloned.id,
        "title": cloned.title,
        "created_at": cloned.created_at.isoformat()
    }


@router.delete("/api/reports/{report_id}")
def delete_report(
    report_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    check_workspace_permission(report.workspace_id, user, db, ["Owner", "Admin", "Analyst"])

    db.delete(report)
    db.commit()
    return {"message": "Report deleted successfully."}


@router.post("/api/reports/{report_id}/share")
def share_report(
    report_id: str,
    req: ShareReportRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    check_workspace_permission(report.workspace_id, user, db, ["Owner", "Admin"])
    report.is_shared = req.is_shared
    report.share_role = req.share_role
    db.commit()
    return {
        "message": f"Report sharing updated. Is shared: {report.is_shared}, Role: {report.share_role}."
    }


# ==========================================
# Original Dataset Report & Exports
# ==========================================

@router.get("/api/datasets/{dataset_id}/report")
def get_dataset_report_by_id(dataset_id: str):
    return get_bundle(dataset_id)["report"]


@router.get("/api/dataset/report")
def get_dataset_report(dataset_id: str = Query(default="demo-sales")):
    return get_bundle(dataset_id)["report"]


def _export_csv(dataset_id: str):
    bundle = get_bundle(dataset_id)
    export_frame = safe_export_frame(bundle["frame"])
    content = export_frame.to_csv(index=False).encode("utf-8-sig")
    filename = Path(bundle["filename"]).stem + "-cleaned.csv"
    return StreamingResponse(
        BytesIO(content),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"}
    )


@router.get("/api/datasets/{dataset_id}/download")
def download_dataset_by_id(dataset_id: str):
    return _export_csv(dataset_id)


@router.get("/api/dataset/export-clean")
def export_clean_dataset(dataset_id: str = Query(default="demo-sales")):
    return _export_csv(dataset_id)


def _export_xlsx(dataset_id: str):
    bundle = get_bundle(dataset_id)
    output = BytesIO()
    safe_export_frame(bundle["frame"]).to_excel(output, index=False, engine="openpyxl")
    filename = Path(bundle["filename"]).stem + "-cleaned.xlsx"
    return StreamingResponse(
        BytesIO(output.getvalue()),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"}
    )


@router.get("/api/datasets/{dataset_id}/download.xlsx")
def download_dataset_xlsx_by_id(dataset_id: str):
    return _export_xlsx(dataset_id)


@router.get("/api/dataset/export-clean.xlsx")
def export_clean_dataset_xlsx(dataset_id: str = Query(default="demo-sales")):
    return _export_xlsx(dataset_id)
