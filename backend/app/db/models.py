import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .session import Base


def generate_uuid():
    return str(uuid.uuid4())


def utc_now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=True, nullable=False)
    verification_token = Column(String(255), nullable=True)
    reset_token = Column(String(255), nullable=True)
    reset_token_expires_at = Column(DateTime, nullable=True)
    theme_preference = Column(String(20), default="dark", nullable=False)
    compact_numbers = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    workspaces = relationship("WorkspaceMember", back_populates="user", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="creator")
    activity_logs = relationship("ActivityLog", back_populates="user")


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    workspaces = relationship("Workspace", back_populates="organization", cascade="all, delete-orphan")


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=True)
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    organization = relationship("Organization", back_populates="workspaces")
    members = relationship("WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan")
    datasets = relationship("DatasetRecord", back_populates="workspace", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="workspace", cascade="all, delete-orphan")
    alerts = relationship("AlertRule", back_populates="workspace", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="workspace")


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(50), default="Viewer", nullable=False)  # Owner, Admin, Analyst, Viewer
    created_at = Column(DateTime, default=utc_now, nullable=False)

    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User", back_populates="workspaces")


class DatasetRecord(Base):
    __tablename__ = "datasets"

    id = Column(String(64), primary_key=True)  # dataset session id or UUID
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    filename = Column(String(255), nullable=False)
    file_size = Column(Integer, default=0, nullable=False)
    rows_count = Column(Integer, default=0, nullable=False)
    columns_count = Column(Integer, default=0, nullable=False)
    dataset_type = Column(String(100), default="Tabular", nullable=False)
    quality_score = Column(Integer, default=100, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    storage_path = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    workspace = relationship("Workspace", back_populates="datasets")
    reports = relationship("Report", back_populates="dataset")


class Report(Base):
    __tablename__ = "reports"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False, index=True)
    dataset_id = Column(String(64), ForeignKey("datasets.id"), nullable=True)
    creator_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    pages_json = Column(Text, default="[]", nullable=False)
    filters_json = Column(Text, default="[]", nullable=False)
    schedule_frequency = Column(String(50), nullable=True)  # daily, weekly, monthly
    is_shared = Column(Boolean, default=False, nullable=False)
    share_role = Column(String(50), default="Viewer", nullable=False)  # Viewer, Editor, Owner
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    workspace = relationship("Workspace", back_populates="reports")
    dataset = relationship("DatasetRecord", back_populates="reports")
    creator = relationship("User", back_populates="reports")
    visuals = relationship("VisualItem", back_populates="report", cascade="all, delete-orphan")


class Dashboard(Base):
    __tablename__ = "dashboards"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    layout_json = Column(Text, default="{}", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)


class VisualItem(Base):
    __tablename__ = "visuals"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    report_id = Column(String(36), ForeignKey("reports.id"), nullable=True)
    dashboard_id = Column(String(36), ForeignKey("dashboards.id"), nullable=True)
    title = Column(String(255), nullable=False)
    visual_type = Column(String(50), nullable=False)
    config_json = Column(Text, default="{}", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    report = relationship("Report", back_populates="visuals")


class AlertRule(Base):
    __tablename__ = "alerts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False, index=True)
    dataset_id = Column(String(64), ForeignKey("datasets.id"), nullable=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    alert_type = Column(String(50), default="threshold", nullable=False)  # threshold, anomaly, kpi_change, scheduled
    metric_column = Column(String(100), nullable=False)
    condition = Column(String(50), default="gt", nullable=False)  # gt, lt, anomaly_detected, pct_change
    threshold_value = Column(Float, nullable=True)
    severity = Column(String(20), default="medium", nullable=False)  # low, medium, high, critical
    is_active = Column(Boolean, default=True, nullable=False)
    delivery_channel = Column(String(50), default="in_app", nullable=False)  # in_app, email, both
    schedule = Column(String(50), default="realtime", nullable=False)  # realtime, daily, weekly, monthly
    last_triggered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    workspace = relationship("Workspace", back_populates="alerts")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=True, index=True)
    action = Column(String(100), nullable=False)  # signup, login, upload, report_create, etc.
    resource_type = Column(String(50), nullable=False)  # user, dataset, report, alert, workspace
    resource_id = Column(String(64), nullable=True)
    description = Column(String(500), nullable=False)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False, index=True)

    user = relationship("User", back_populates="activity_logs")
    workspace = relationship("Workspace", back_populates="activity_logs")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(100), default="Default Ingestion Key", nullable=False)
    key_prefix = Column(String(20), nullable=False)
    token = Column(String(255), unique=True, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    user = relationship("User")


class NotificationSetting(Base):
    __tablename__ = "notification_settings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    slack_webhook_url = Column(String(500), nullable=True)
    email_enabled = Column(Boolean, default=True, nullable=False)
    frequency = Column(String(50), default="instant", nullable=False)  # instant, daily, weekly
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User")

