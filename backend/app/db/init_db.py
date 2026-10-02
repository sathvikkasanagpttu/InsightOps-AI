from datetime import datetime
from sqlalchemy.orm import Session

from .models import (
    ActivityLog,
    AlertRule,
    Organization,
    Report,
    User,
    Workspace,
    WorkspaceMember,
)
from .session import Base, SessionLocal, engine
from ..core.security import hash_password


def init_db(target_engine=None, target_session_factory=None):
    use_engine = target_engine or engine
    use_session = target_session_factory or SessionLocal
    # Create all tables in database
    Base.metadata.create_all(bind=use_engine)

    db: Session = use_session()
    try:
        # Check if default admin exists
        admin = db.query(User).filter(User.email == "admin@insightops.ai").first()
        if not admin:
            admin = User(
                email="admin@insightops.ai",
                hashed_password=hash_password("Password123!"),
                full_name="Administrator",
                avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
                is_active=True,
                is_verified=True,
                theme_preference="dark",
                compact_numbers=True
            )
            db.add(admin)
            db.flush()

            # Create default Organization
            org = Organization(
                name="InsightOps Global",
                slug="insightops-global",
                owner_id=admin.id
            )
            db.add(org)
            db.flush()

            # Create default Workspaces
            ws_default = Workspace(
                id="default-workspace",
                organization_id=org.id,
                owner_id=admin.id,
                name="Production Analytics",
                description="Primary workspace for corporate BI, sales data and executive intelligence."
            )
            ws_sales = Workspace(
                id="sales-workspace",
                organization_id=org.id,
                owner_id=admin.id,
                name="Sales & Growth",
                description="Regional sales distribution, pipeline velocity and customer intelligence."
            )
            ws_sandbox = Workspace(
                id="sandbox-workspace",
                organization_id=org.id,
                owner_id=admin.id,
                name="Executive Sandbox",
                description="Exploratory modeling, ad-hoc visual builder reports and forecasting."
            )
            db.add_all([ws_default, ws_sales, ws_sandbox])
            db.flush()

            # Add memberships
            db.add_all([
                WorkspaceMember(workspace_id=ws_default.id, user_id=admin.id, role="Owner"),
                WorkspaceMember(workspace_id=ws_sales.id, user_id=admin.id, role="Admin"),
                WorkspaceMember(workspace_id=ws_sandbox.id, user_id=admin.id, role="Owner"),
            ])

            # Seed default Alerts
            db.add_all([
                AlertRule(
                    workspace_id=ws_default.id,
                    user_id=admin.id,
                    name="High Revenue Outlier Spike",
                    alert_type="anomaly",
                    metric_column="revenue",
                    condition="anomaly_detected",
                    severity="high",
                    is_active=True,
                    delivery_channel="in_app",
                    schedule="realtime"
                ),
                AlertRule(
                    workspace_id=ws_default.id,
                    user_id=admin.id,
                    name="Monthly Revenue Goal (>$1M)",
                    alert_type="threshold",
                    metric_column="revenue",
                    condition="gt",
                    threshold_value=1000000.0,
                    severity="medium",
                    is_active=True,
                    delivery_channel="both",
                    schedule="daily"
                ),
                AlertRule(
                    workspace_id=ws_default.id,
                    user_id=admin.id,
                    name="Data Quality Degradation (<85%)",
                    alert_type="threshold",
                    metric_column="quality_score",
                    condition="lt",
                    threshold_value=85.0,
                    severity="critical",
                    is_active=True,
                    delivery_channel="in_app",
                    schedule="realtime"
                )
            ])

            # Seed Initial Activity Log
            db.add_all([
                ActivityLog(
                    user_id=admin.id,
                    workspace_id=ws_default.id,
                    action="system_init",
                    resource_type="workspace",
                    resource_id=ws_default.id,
                    description="Initialized InsightOps AI Enterprise Workspace and security policies."
                ),
                ActivityLog(
                    user_id=admin.id,
                    workspace_id=ws_default.id,
                    action="login",
                    resource_type="user",
                    resource_id=admin.id,
                    description="Admin signed in and configured default alert rules."
                )
            ])

            db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()
