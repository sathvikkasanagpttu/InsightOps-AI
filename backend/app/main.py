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
from .dataset_engine import analyze_dataset, generate_answer
from .dataset_store import DatasetStore
from .services.ingestion import MAX_UPLOAD_BYTES

ROOT = Path(__file__).resolve().parents[2]
store = DatasetStore(ROOT / "data" / "uploads", ROOT / "data" / "sample" / "sales.csv")

app = FastAPI(
    title="InsightOps AI — Universal Live Data Intelligence Platform",
    description="Universal data analytics API for automated data ingestion, cleaning, profiling, KPIs, visualizations, insights, anomalies, and forecasting.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount modular routers
app.include_router(upload_router)
app.include_router(profile_router)
app.include_router(analysis_router)
app.include_router(visualization_router)
app.include_router(forecast_router)
app.include_router(anomalies_router)
app.include_router(insights_router)
app.include_router(reports_router)


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "InsightOps AI",
        "version": "2.0.0",
        "platform": "Universal Live Data Intelligence Platform"
    }
