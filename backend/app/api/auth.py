from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from ..core.auth_middleware import get_current_user
from ..core.security import (
    create_access_token,
    create_refresh_token,
    decode_jwt_token,
    generate_random_token,
    hash_password,
    verify_password,
)
from ..db.models import ActivityLog, Organization, User, Workspace, WorkspaceMember
from ..db.session import get_db

router = APIRouter(prefix="/api/auth", tags=["Authentication & User"])


# ==========================================
# Pydantic Schemas
# ==========================================

class SignUpRequest(BaseModel):
    email: str = Field(min_length=5)
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2)
    workspace_name: Optional[str] = "My Workspace"

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email format")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str
    remember_me: bool = True

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return v.strip().lower()


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return v.strip().lower()


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    theme_preference: Optional[str] = None
    compact_numbers: Optional[bool] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


# ==========================================
# Endpoints
# ==========================================

@router.post("/signup")
def signup(req: SignUpRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    user = User(
        email=req.email.lower(),
        hashed_password=hash_password(req.password),
        full_name=req.full_name,
        is_active=True,
        is_verified=True,  # Auto-verified for local/production convenience
        theme_preference="dark",
        compact_numbers=True
    )
    db.add(user)
    db.flush()

    # Create Organization & Personal Workspace
    slug = req.full_name.lower().replace(" ", "-") + "-" + user.id[:6]
    org = Organization(
        name=f"{req.full_name}'s Org",
        slug=slug,
        owner_id=user.id
    )
    db.add(org)
    db.flush()

    workspace = Workspace(
        organization_id=org.id,
        owner_id=user.id,
        name=req.workspace_name or f"{req.full_name}'s Workspace",
        description="Personal analytics and BI workspace."
    )
    db.add(workspace)
    db.flush()

    # Assign Owner role
    membership = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=user.id,
        role="Owner"
    )
    db.add(membership)

    # Log activity
    db.add(ActivityLog(
        user_id=user.id,
        workspace_id=workspace.id,
        action="signup",
        resource_type="user",
        resource_id=user.id,
        description=f"Account created for {user.full_name} ({user.email})."
    ))

    db.commit()

    access_token = create_access_token(user.id, user.email, role="Owner")
    refresh_token = create_refresh_token(user.id)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "avatar_url": user.avatar_url,
            "theme_preference": user.theme_preference,
            "compact_numbers": user.compact_numbers,
            "active_workspace_id": workspace.id,
            "role": "Owner"
        }
    }


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower()).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated.")

    # Find primary workspace
    member = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).first()
    active_workspace_id = member.workspace_id if member else None
    role = member.role if member else "Viewer"

    access_token = create_access_token(user.id, user.email, role=role)
    refresh_token = create_refresh_token(user.id)

    # Log login activity
    db.add(ActivityLog(
        user_id=user.id,
        workspace_id=active_workspace_id,
        action="login",
        resource_type="user",
        resource_id=user.id,
        description=f"User {user.full_name} signed in successfully."
    ))
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "avatar_url": user.avatar_url,
            "theme_preference": user.theme_preference,
            "compact_numbers": user.compact_numbers,
            "active_workspace_id": active_workspace_id,
            "role": role
        }
    }


@router.post("/refresh")
def refresh_token(req: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_jwt_token(req.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token. Please sign in again."
        )

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    member = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).first()
    role = member.role if member else "Viewer"

    new_access_token = create_access_token(user.id, user.email, role=role)
    return {
        "access_token": new_access_token,
        "token_type": "bearer"
    }


@router.get("/me")
def get_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    memberships = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).all()
    workspaces = []
    for m in memberships:
        ws = db.query(Workspace).filter(Workspace.id == m.workspace_id).first()
        if ws:
            workspaces.append({
                "id": ws.id,
                "name": ws.name,
                "description": ws.description,
                "role": m.role
            })

    active_ws_id = workspaces[0]["id"] if workspaces else None

    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "avatar_url": user.avatar_url,
        "theme_preference": user.theme_preference,
        "compact_numbers": user.compact_numbers,
        "is_verified": user.is_verified,
        "created_at": user.created_at.isoformat(),
        "workspaces": workspaces,
        "active_workspace_id": active_ws_id
    }


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower()).first()
    if user:
        token = generate_random_token()
        user.reset_token = token
        user.reset_token_expires_at = datetime.utcnow() + timedelta(hours=1)
        db.add(ActivityLog(
            user_id=user.id,
            action="password_reset_request",
            resource_type="user",
            resource_id=user.id,
            description=f"Password reset requested for {user.email}."
        ))
        db.commit()
        # In a real email environment, this token would be emailed. For direct dev/test verification:
        return {
            "message": "Password reset instructions have been generated.",
            "reset_token": token
        }
    return {"message": "If this email exists in our system, reset instructions have been sent."}


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.reset_token == req.token,
        User.reset_token_expires_at > datetime.utcnow()
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token."
        )

    user.hashed_password = hash_password(req.new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    db.add(ActivityLog(
        user_id=user.id,
        action="password_reset_success",
        resource_type="user",
        resource_id=user.id,
        description=f"Password successfully reset for {user.email}."
    ))
    db.commit()
    return {"message": "Password has been successfully updated. You may now sign in."}


@router.put("/profile")
def update_profile(
    req: ProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if req.full_name is not None:
        user.full_name = req.full_name
    if req.avatar_url is not None:
        user.avatar_url = req.avatar_url
    if req.theme_preference is not None:
        user.theme_preference = req.theme_preference
    if req.compact_numbers is not None:
        user.compact_numbers = req.compact_numbers

    db.add(ActivityLog(
        user_id=user.id,
        action="profile_update",
        resource_type="user",
        resource_id=user.id,
        description=f"User {user.full_name} updated profile settings."
    ))
    db.commit()
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "avatar_url": user.avatar_url,
        "theme_preference": user.theme_preference,
        "compact_numbers": user.compact_numbers
    }


@router.put("/password")
def change_password(
    req: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(req.current_password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")

    user.hashed_password = hash_password(req.new_password)
    db.add(ActivityLog(
        user_id=user.id,
        action="password_change",
        resource_type="user",
        resource_id=user.id,
        description=f"Password changed successfully for {user.email}."
    ))
    db.commit()
    return {"message": "Password changed successfully."}


@router.post("/logout")
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.add(ActivityLog(
        user_id=user.id,
        action="logout",
        resource_type="user",
        resource_id=user.id,
        description=f"User {user.full_name} signed out."
    ))
    db.commit()
    return {"message": "Signed out successfully."}
