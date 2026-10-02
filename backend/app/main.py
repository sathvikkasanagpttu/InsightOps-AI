from io import BytesIO
from pathlib import Path
from urllib.parse import quote

import pandas as pd
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .dataset_engine import analyze_dataset, generate_answer
from .dataset_store import MAX_UPLOAD_BYTES, DatasetStore

ROOT = Path(__file__).resolve().parents[2]
store = DatasetStore(ROOT / "data" / "uploads", ROOT / "data" / "sample" / "sales.csv")

app = FastAPI(title="InsightOps AI API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])


class AnalystQuestion(BaseModel):
    dataset_id: str = "demo-sales"
    question: str = Field(min_length=1, max_length=1000)


def _bundle(dataset_id: str) -> dict:
    try:
        return store.get(dataset_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _kpi_value(report: dict, label: str):
    return next((item["value"] for item in report["kpis"] if item["label"] == label), 0)


@app.get("/api/health")
def health():
    return {"status": "healthy", "service": "InsightOps AI", "version": "2.0.0"}


@app.post("/api/dataset/upload")
@app.post("/api/dataset", include_in_schema=False)
async def upload_dataset(file: UploadFile = File(...)):
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    try:
        return store.upload(file.filename, content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/dataset/profile")
@app.get("/api/dataset", include_in_schema=False)
def dataset_profile(dataset_id: str = Query(default="demo-sales")):
    return _bundle(dataset_id)["report"]


@app.get("/api/dataset/schema")
def dataset_schema(dataset_id: str = Query(default="demo-sales")):
    report = _bundle(dataset_id)["report"]
    return {"dataset_id": dataset_id, "columns": report["schema"]}


@app.get("/api/dataset/quality")
def dataset_quality(dataset_id: str = Query(default="demo-sales")):
    return _bundle(dataset_id)["report"]["quality"]


@app.get("/api/dataset/kpis")
def dataset_kpis(dataset_id: str = Query(default="demo-sales")):
    report = _bundle(dataset_id)["report"]
    return {"dataset_id": dataset_id, "dataset_type": report["dataset_type"], "kpis": report["kpis"]}


@app.get("/api/dataset/insights")
def dataset_insights(dataset_id: str = Query(default="demo-sales")):
    return _bundle(dataset_id)["report"]["insights"]


@app.get("/api/dataset/charts")
def dataset_charts(dataset_id: str = Query(default="demo-sales")):
    return _bundle(dataset_id)["report"]["charts"]


@app.get("/api/dataset/forecast")
def dataset_forecast(dataset_id: str = Query(default="demo-sales")):
    return _bundle(dataset_id)["report"]["forecast"]


@app.get("/api/dataset/alerts")
def dataset_alerts(dataset_id: str = Query(default="demo-sales")):
    return _bundle(dataset_id)["report"]["alerts"]


@app.post("/api/analyst/ask")
def analyst_ask(request: AnalystQuestion):
    bundle = _bundle(request.dataset_id)
    return generate_answer(bundle["frame"], bundle["report"], request.question)


@app.get("/api/dataset/export-clean")
def export_clean_dataset(dataset_id: str = Query(default="demo-sales")):
    bundle = _bundle(dataset_id)
    content = bundle["frame"].to_csv(index=False).encode("utf-8-sig")
    filename = Path(bundle["filename"]).stem + "-cleaned.csv"
    return StreamingResponse(BytesIO(content), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"})


@app.post("/api/profile")
async def profile_upload(file: UploadFile = File(...)):
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    try:
        extension = Path(file.filename or "dataset.csv").suffix.lower()
        frame = DatasetStore._read_frame(content, extension)
        _, report = analyze_dataset(frame, file.filename or "dataset")
        return report
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# Compatibility routes retain the original demo API while all dashboard data is now dataset-scoped.
@app.get("/api/overview")
def overview(dataset_id: str = Query(default="demo-sales")):
    report = _bundle(dataset_id)["report"]
    return {"analysis_mode": report["analysis_mode"], "dataset_type": report["dataset_type"],
            "revenue": _kpi_value(report, "Total Revenue"), "orders": _kpi_value(report, "Total Orders"),
            "customers": _kpi_value(report, "Unique Contacts"), "profit": _kpi_value(report, "Total Profit"),
            "growth": 0, "aov": _kpi_value(report, "Average Order Value"),
            "margin": _kpi_value(report, "Profit Margin"), "records": report["rows"],
            "columns": report["column_count"], "quality_score": report["quality_score"]}


@app.get("/api/trends")
def trends(dataset_id: str = Query(default="demo-sales")):
    return _bundle(dataset_id)["report"]["time_series"]


@app.get("/api/categories")
def categories(dataset_id: str = Query(default="demo-sales")):
    return [item for item in _bundle(dataset_id)["report"]["dimensions"]
            if item["semantic_type"] in {"category", "status", "source", "delivery_mode"}]


@app.get("/api/regions")
def regions(dataset_id: str = Query(default="demo-sales")):
    return [item for item in _bundle(dataset_id)["report"]["dimensions"]
            if item["semantic_type"] in {"region", "location"}]


@app.get("/api/anomalies")
def anomalies(dataset_id: str = Query(default="demo-sales")):
    return _bundle(dataset_id)["report"]["alerts"]


@app.get("/api/forecast")
def forecast(dataset_id: str = Query(default="demo-sales")):
    return _bundle(dataset_id)["report"]["forecast"]


@app.get("/api/ask")
def ask(q: str, dataset_id: str = Query(default="demo-sales")):
    bundle = _bundle(dataset_id)
    return generate_answer(bundle["frame"], bundle["report"], q)
