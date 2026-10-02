from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import (
    analysis_router,
    anomalies_router,
    forecast_router,
    insights_router,
    profile_router,
    reports_router,
    upload_router,
    visualization_router,
)
from .api.activity_saas import router as activity_router
from .api.alerts_saas import router as alerts_router
from .api.auth import router as auth_router
from .api.search_saas import router as search_router
from .api.system_saas import router as system_router
from .api.workspaces import router as workspaces_router
from .dataset_engine import analyze_dataset, generate_answer
from .dataset_store import DatasetStore
from .db.init_db import init_db
from .services.ingestion import MAX_UPLOAD_BYTES

ROOT = Path(__file__).resolve().parents[2]
store = DatasetStore(ROOT / "data" / "uploads", ROOT / "data" / "sample" / "sales.csv")

# Initialize database tables and seeds
try:
    init_db()
except Exception as e:
    print(f"Database initialization notice: {e}")

app = FastAPI(
    title="InsightOps AI — Enterprise BI SaaS Platform",
    description="Universal data analytics API with Power BI dynamic visualizations, enterprise authentication, RBAC, workspaces, reports, alerts, and AI Analyst.",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all routers
app.include_router(auth_router)
app.include_router(workspaces_router)
app.include_router(upload_router)
app.include_router(profile_router)
app.include_router(analysis_router)
app.include_router(visualization_router)
app.include_router(forecast_router)
app.include_router(anomalies_router)
app.include_router(insights_router)
app.include_router(reports_router)
app.include_router(alerts_router)
app.include_router(activity_router)
app.include_router(search_router)
app.include_router(system_router)


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "InsightOps AI",
        "version": "3.0.0",
        "platform": "Enterprise AI Business Intelligence SaaS Platform"
    }
