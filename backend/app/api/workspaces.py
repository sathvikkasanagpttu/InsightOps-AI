from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from ..core.auth_middleware import check_workspace_permission, get_current_user
from ..db.models import ActivityLog, User, Workspace, WorkspaceMember
from ..db.session import get_db

router = APIRouter(prefix="/api/workspaces", tags=["Workspaces & RBAC"])


class CreateWorkspaceRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: Optional[str] = None


class UpdateWorkspaceRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class AddMemberRequest(BaseModel):
    email: str = Field(min_length=5)
    role: str = Field(default="Analyst", description="Owner, Admin, Analyst, Viewer")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email format")
        return v


class UpdateMemberRoleRequest(BaseModel):
    role: str = Field(description="Owner, Admin, Analyst, Viewer")


@router.get("")
def list_workspaces(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    memberships = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).all()
    result = []
    for m in memberships:
        ws = db.query(Workspace).filter(Workspace.id == m.workspace_id).first()
        if not ws:
            continue
        member_count = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == ws.id).count()
        dataset_count = len(ws.datasets) if ws.datasets else 0
        report_count = len(ws.reports) if ws.reports else 0
        result.append({
            "id": ws.id,
            "name": ws.name,
            "description": ws.description,
            "owner_id": ws.owner_id,
            "role": m.role,
            "member_count": member_count,
            "dataset_count": dataset_count,
            "report_count": report_count,
            "created_at": ws.created_at.isoformat()
        })
    return result


@router.post("")
def create_workspace(
    req: CreateWorkspaceRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ws = Workspace(
        owner_id=user.id,
        name=req.name,
        description=req.description
    )
    db.add(ws)
    db.flush()

    membership = WorkspaceMember(
        workspace_id=ws.id,
        user_id=user.id,
        role="Owner"
    )
    db.add(membership)

    db.add(ActivityLog(
        user_id=user.id,
        workspace_id=ws.id,
        action="workspace_create",
        resource_type="workspace",
        resource_id=ws.id,
        description=f"Created workspace '{ws.name}'."
    ))
    db.commit()

    return {
        "id": ws.id,
        "name": ws.name,
        "description": ws.description,
        "role": "Owner",
        "created_at": ws.created_at.isoformat()
    }


@router.get("/{workspace_id}")
def get_workspace(
    workspace_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    member = check_workspace_permission(workspace_id, user, db, ["Owner", "Admin", "Analyst", "Viewer"])
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    return {
        "id": ws.id,
        "name": ws.name,
        "description": ws.description,
        "owner_id": ws.owner_id,
        "role": member.role,
        "created_at": ws.created_at.isoformat()
    }


@router.put("/{workspace_id}")
def update_workspace(
    workspace_id: str,
    req: UpdateWorkspaceRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_workspace_permission(workspace_id, user, db, ["Owner", "Admin"])
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if req.name:
        ws.name = req.name
    if req.description is not None:
        ws.description = req.description

    db.add(ActivityLog(
        user_id=user.id,
        workspace_id=ws.id,
        action="workspace_update",
        resource_type="workspace",
        resource_id=ws.id,
        description=f"Updated workspace settings for '{ws.name}'."
    ))
    db.commit()
    return {"message": "Workspace updated successfully."}


@router.delete("/{workspace_id}")
def delete_workspace(
    workspace_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_workspace_permission(workspace_id, user, db, ["Owner"])
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if ws.id in {"default-workspace", "sales-workspace"}:
        raise HTTPException(status_code=400, detail="Default demonstration workspaces cannot be deleted.")

    db.delete(ws)
    db.commit()
    return {"message": "Workspace deleted successfully."}


@router.get("/{workspace_id}/members")
def list_workspace_members(
    workspace_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_workspace_permission(workspace_id, user, db, ["Owner", "Admin", "Analyst", "Viewer"])
    members = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == workspace_id).all()
    results = []
    for m in members:
        u = db.query(User).filter(User.id == m.user_id).first()
        if u:
            results.append({
                "user_id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "avatar_url": u.avatar_url,
                "role": m.role,
                "joined_at": m.created_at.isoformat()
            })
    return results


@router.post("/{workspace_id}/members")
def add_workspace_member(
    workspace_id: str,
    req: AddMemberRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_workspace_permission(workspace_id, user, db, ["Owner", "Admin"])
    target_user = db.query(User).filter(User.email == req.email.lower()).first()
    if not target_user:
        # Create invited stub user if does not exist
        from ..core.security import hash_password
        target_user = User(
            email=req.email.lower(),
            hashed_password=hash_password("Welcome123!"),
            full_name=req.email.split("@")[0].capitalize(),
            is_active=True
        )
        db.add(target_user)
        db.flush()

    existing_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == target_user.id
    ).first()

    if existing_member:
        existing_member.role = req.role
    else:
        membership = WorkspaceMember(
            workspace_id=workspace_id,
            user_id=target_user.id,
            role=req.role
        )
        db.add(membership)

    db.add(ActivityLog(
        user_id=user.id,
        workspace_id=workspace_id,
        action="member_invite",
        resource_type="workspace",
        resource_id=workspace_id,
        description=f"Assigned {target_user.email} role '{req.role}' in workspace."
    ))
    db.commit()
    return {"message": f"{target_user.email} successfully added as {req.role}."}


@router.put("/{workspace_id}/members/{target_user_id}")
def update_workspace_member_role(
    workspace_id: str,
    target_user_id: str,
    req: UpdateMemberRoleRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_workspace_permission(workspace_id, user, db, ["Owner", "Admin"])
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == target_user_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found in workspace.")

    member.role = req.role
    db.commit()
    return {"message": f"Updated role to {req.role}."}


@router.delete("/{workspace_id}/members/{target_user_id}")
def remove_workspace_member(
    workspace_id: str,
    target_user_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_workspace_permission(workspace_id, user, db, ["Owner", "Admin"])
    if target_user_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself from workspace.")

    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == target_user_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found in workspace.")

    db.delete(member)
    db.commit()
    return {"message": "Member removed from workspace."}
