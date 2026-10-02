from pathlib import Path
from typing import Optional
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
import pandas as pd

from ..deps import get_bundle, get_store, json_value
from ..services.ingestion import MAX_UPLOAD_BYTES

router = APIRouter(tags=["Upload & Ingestion"])


def _max_upload_bytes() -> int:
    try:
        from .. import main as m
        return getattr(m, "MAX_UPLOAD_BYTES", MAX_UPLOAD_BYTES)
    except Exception:
        return MAX_UPLOAD_BYTES


@router.post("/api/datasets/upload")
@router.post("/api/dataset/upload")
@router.post("/api/dataset", include_in_schema=False)
async def upload_dataset(
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Form(default=None)
):
    limit = _max_upload_bytes()
    content = await file.read(limit + 1)
    if len(content) > limit:
        raise HTTPException(status_code=413, detail="Files must be 50 MB or smaller.")
    store = get_store()
    try:
        return store.upload(file.filename, content, sheet_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/api/datasets/preview")
@router.post("/api/dataset/preview")
async def preview_dataset(
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Form(default=None)
):
    limit = _max_upload_bytes()
    content = await file.read(limit + 1)
    if len(content) > limit:
        raise HTTPException(status_code=413, detail="Files must be 50 MB or smaller.")
    store = get_store()
    try:
        return store.preview(file.filename, content, sheet_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/datasets/{dataset_id}")
def get_dataset(dataset_id: str):
    bundle = get_bundle(dataset_id)
    report = bundle["report"]
    return {
        "dataset_id": dataset_id,
        "filename": report["filename"],
        "created_at": report.get("created_at"),
        "rows": report["rows"],
        "columns": report["column_count"],
        "status": "analyzed",
        "quality_score": report.get("quality_score"),
        "file_size": report.get("file_size"),
    }


@router.delete("/api/datasets/{dataset_id}")
def delete_dataset(dataset_id: str):
    store = get_store()
    try:
        store.delete(dataset_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"dataset_id": dataset_id, "status": "removed"}


def _get_rows(dataset_id: str, page: int, page_size: int, search: str, sort_by: str, sort_order: str):
    bundle = get_bundle(dataset_id)
    report = bundle["report"]
    frame = bundle["frame"]
    columns = report["schema"]
    sensitive = {col["name"] for col in columns if col["semantic_type"] in {"email", "phone"}}

    if search:
        searchable = [col["name"] for col in columns if col["name"] not in sensitive]
        mask = pd.Series(False, index=frame.index)
        for col in searchable:
            mask |= frame[col].astype("string").str.contains(search, case=False, regex=False, na=False)
        frame = frame[mask]

    if sort_by in frame.columns:
        frame = frame.sort_values(sort_by, ascending=sort_order == "asc", na_position="last")

    total = len(frame)
    start = (page - 1) * page_size
    sliced = frame.iloc[start:start + page_size]

    rows = [
        {col["name"]: json_value(row[col["name"]], col["semantic_type"]) for col in columns}
        for _, row in sliced.iterrows()
    ]

    return {
        "dataset_id": dataset_id,
        "page": page,
        "page_size": page_size,
        "total": total,
        "columns": [
            {
                "name": col["name"],
                "original_name": col["original_name"],
                "semantic_type": col["semantic_type"],
                "data_type": col["data_type"]
            }
            for col in columns
        ],
        "rows": rows
    }


@router.get("/api/dataset/rows")
def dataset_rows(
    dataset_id: str = Query(default="demo-sales"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    search: str = "",
    sort_by: str = "",
    sort_order: str = Query(default="asc", pattern="^(asc|desc)$")
):
    return _get_rows(dataset_id, page, page_size, search, sort_by, sort_order)


@router.get("/api/datasets/{dataset_id}/rows")
def dataset_rows_by_id(
    dataset_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    search: str = "",
    sort_by: str = "",
    sort_order: str = Query(default="asc", pattern="^(asc|desc)$")
):
    return _get_rows(dataset_id, page, page_size, search, sort_by, sort_order)
