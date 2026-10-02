import os
import platform
import sys
import time
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..db.session import engine, get_db

router = APIRouter(prefix="/api/system", tags=["System & Health"])

START_TIME = time.time()


@router.get("/health")
def detailed_health_check(db: Session = Depends(get_db)):
    # 1. Database connectivity
    db_status = "healthy"
    db_type = engine.dialect.name
    table_counts = {}
    try:
        from ..db.models import ActivityLog, AlertRule, DatasetRecord, Organization, Report, User, Workspace
        table_counts = {
            "users": db.query(User).count(),
            "workspaces": db.query(Workspace).count(),
            "organizations": db.query(Organization).count(),
            "reports": db.query(Report).count(),
            "alerts": db.query(AlertRule).count(),
            "datasets": db.query(DatasetRecord).count(),
            "activity_logs": db.query(ActivityLog).count()
        }
    except Exception as exc:
        db_status = f"unhealthy: {str(exc)}"

    uptime_seconds = int(time.time() - START_TIME)

    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "service": "InsightOps AI Enterprise BI SaaS",
        "version": "3.0.0-production",
        "database": {
            "status": db_status,
            "engine": db_type,
            "tables": table_counts
        },
        "system": {
            "os": platform.system(),
            "python_version": sys.version.split(" ")[0],
            "architecture": platform.machine(),
            "uptime_seconds": uptime_seconds,
            "uptime_formatted": f"{uptime_seconds // 3600}h {(uptime_seconds % 3600) // 60}m {uptime_seconds % 60}s"
        },
        "features": {
            "authentication": "JWT (HS256) + PBKDF2-HMAC-SHA256",
            "rbac": ["Owner", "Admin", "Analyst", "Viewer"],
            "dynamic_visual_engine": "18 Power BI Visual Types + Cross-Filtering",
            "predictive_engine": "Holt-Winters Exponential Smoothing + 95% CI",
            "ai_analyst": "Deterministic NL-to-Formula Query Engine",
            "multi_page_reports": True
        }
    }
