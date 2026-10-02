from io import BytesIO
from pathlib import Path
from urllib.parse import quote

import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
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


class PathAnalystQuestion(BaseModel):
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


def _clean_export_bytes(frame: pd.DataFrame) -> bytes:
    export_frame = _safe_export_frame(frame)
    return export_frame.to_csv(index=False).encode("utf-8-sig")


def _safe_export_frame(frame: pd.DataFrame) -> pd.DataFrame:
    export_frame = frame.copy()
    for column in export_frame.select_dtypes(include=["object", "string"]).columns:
        export_frame[column] = export_frame[column].map(
            lambda value: f"'{value}" if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")) else value
        )
    return export_frame


def _json_value(value, semantic_type: str):
    if pd.isna(value):
        return None
    if semantic_type in {"email", "phone"}:
        from .dataset_engine import _mask_value
        return _mask_value(value, semantic_type)
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if hasattr(value, "item"):
        return value.item()
    return value if isinstance(value, (str, int, float, bool)) else str(value)


@app.get("/api/dataset/rows")
def dataset_rows(dataset_id: str = Query(default="demo-sales"), page: int = Query(default=1, ge=1),
                 page_size: int = Query(default=50, ge=1, le=100), search: str = "",
                 sort_by: str = "", sort_order: str = Query(default="asc", pattern="^(asc|desc)$")):
    bundle = _bundle(dataset_id)
    report = bundle["report"]
    frame = bundle["frame"]
    columns = report["schema"]
    sensitive = {column["name"] for column in columns if column["semantic_type"] in {"email", "phone"}}
    if search:
        searchable = [column["name"] for column in columns if column["name"] not in sensitive]
        mask = pd.Series(False, index=frame.index)
        for column in searchable:
            mask |= frame[column].astype("string").str.contains(search, case=False, regex=False, na=False)
        frame = frame[mask]
    if sort_by in frame.columns:
        frame = frame.sort_values(sort_by, ascending=sort_order == "asc", na_position="last")
    total = len(frame)
    start = (page - 1) * page_size
    rows = [{column["name"]: _json_value(row[column["name"]], column["semantic_type"])
             for column in columns} for _, row in frame.iloc[start:start + page_size].iterrows()]
    return {"dataset_id": dataset_id, "page": page, "page_size": page_size, "total": total,
            "columns": [{"name": column["name"], "original_name": column["original_name"],
                         "semantic_type": column["semantic_type"], "data_type": column["data_type"]}
                        for column in columns], "rows": rows}


@app.get("/api/health")
def health():
    return {"status": "healthy", "service": "InsightOps AI", "version": "2.0.0"}


@app.post("/api/datasets/upload")
@app.post("/api/dataset/upload")
@app.post("/api/dataset", include_in_schema=False)
async def upload_dataset(file: UploadFile = File(...), sheet_name: str | None = Form(default=None)):
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Files must be 50 MB or smaller.")
    try:
        return store.upload(file.filename, content, sheet_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/datasets/preview")
@app.post("/api/dataset/preview")
async def preview_dataset(file: UploadFile = File(...), sheet_name: str | None = Form(default=None)):
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Files must be 50 MB or smaller.")
    try:
        return store.preview(file.filename, content, sheet_name)
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
    content = _clean_export_bytes(bundle["frame"])
    filename = Path(bundle["filename"]).stem + "-cleaned.csv"
    return StreamingResponse(BytesIO(content), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"})


@app.get("/api/dataset/export-clean.xlsx")
def export_clean_dataset_xlsx(dataset_id: str = Query(default="demo-sales")):
    bundle = _bundle(dataset_id)
    output = BytesIO()
    _safe_export_frame(bundle["frame"]).to_excel(output, index=False, engine="openpyxl")
    filename = Path(bundle["filename"]).stem + "-cleaned.xlsx"
    return StreamingResponse(BytesIO(output.getvalue()),
                             media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"})


@app.get("/api/dataset/report")
def dataset_report(dataset_id: str = Query(default="demo-sales")):
    return _bundle(dataset_id)["report"]


@app.get("/api/datasets/{dataset_id}")
def get_dataset(dataset_id: str):
    report = _bundle(dataset_id)["report"]
    return {"dataset_id": dataset_id, "filename": report["filename"],
            "created_at": report.get("created_at"), "rows": report["rows"],
            "columns": report["column_count"], "status": "analyzed"}


@app.get("/api/datasets/{dataset_id}/profile")
def get_dataset_profile(dataset_id: str):
    return _bundle(dataset_id)["report"]


@app.post("/api/datasets/{dataset_id}/clean")
def clean_dataset(dataset_id: str):
    report = _bundle(dataset_id)["report"]
    return {"dataset_id": dataset_id, "cleaning_report": report["cleaning_report"],
            "quality": report["quality"]}


@app.get("/api/datasets/{dataset_id}/kpis")
def get_dataset_kpis(dataset_id: str):
    report = _bundle(dataset_id)["report"]
    return {"dataset_id": dataset_id, "dataset_type": report["dataset_type"], "kpis": report["kpis"]}


@app.get("/api/datasets/{dataset_id}/visualizations")
def get_dataset_visualizations(dataset_id: str):
    return _bundle(dataset_id)["report"]["charts"]


@app.get("/api/datasets/{dataset_id}/insights")
def get_dataset_insights(dataset_id: str):
    return _bundle(dataset_id)["report"]["insights"]


@app.get("/api/datasets/{dataset_id}/anomalies")
def get_dataset_anomalies(dataset_id: str):
    return _bundle(dataset_id)["report"]["alerts"]


@app.get("/api/datasets/{dataset_id}/forecast")
def get_dataset_forecast(dataset_id: str):
    return _bundle(dataset_id)["report"]["forecast"]


@app.post("/api/datasets/{dataset_id}/ask")
def ask_dataset(dataset_id: str, request: PathAnalystQuestion):
    bundle = _bundle(dataset_id)
    return generate_answer(bundle["frame"], bundle["report"], request.question)


@app.get("/api/datasets/{dataset_id}/report")
def export_dataset_report(dataset_id: str):
    return _bundle(dataset_id)["report"]


@app.get("/api/datasets/{dataset_id}/download")
def download_dataset(dataset_id: str):
    return export_clean_dataset(dataset_id)


@app.post("/api/profile")
async def profile_upload(file: UploadFile = File(...)):
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Files must be 50 MB or smaller.")
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
