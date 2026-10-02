from pathlib import Path
from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from ..dataset_engine import analyze_dataset
from ..deps import get_bundle
from ..services.ingestion import MAX_UPLOAD_BYTES, read_dataset_frame

router = APIRouter(tags=["Dataset Profile"])


@router.get("/api/datasets/{dataset_id}/profile")
def get_dataset_profile_by_id(dataset_id: str):
    return get_bundle(dataset_id)["report"]


@router.get("/api/dataset/profile")
@router.get("/api/dataset", include_in_schema=False)
def get_dataset_profile(dataset_id: str = Query(default="demo-sales")):
    return get_bundle(dataset_id)["report"]


@router.get("/api/datasets/{dataset_id}/schema")
def get_dataset_schema_by_id(dataset_id: str):
    report = get_bundle(dataset_id)["report"]
    return {"dataset_id": dataset_id, "columns": report["schema"]}


@router.get("/api/dataset/schema")
def get_dataset_schema(dataset_id: str = Query(default="demo-sales")):
    report = get_bundle(dataset_id)["report"]
    return {"dataset_id": dataset_id, "columns": report["schema"]}


@router.get("/api/datasets/{dataset_id}/quality")
def get_dataset_quality_by_id(dataset_id: str):
    return get_bundle(dataset_id)["report"]["quality"]


@router.get("/api/dataset/quality")
def get_dataset_quality(dataset_id: str = Query(default="demo-sales")):
    return get_bundle(dataset_id)["report"]["quality"]


@router.post("/api/profile")
async def profile_upload(file: UploadFile = File(...)):
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Files must be 50 MB or smaller.")
    try:
        ext = Path(file.filename or "dataset.csv").suffix.lower()
        frame, _, _ = read_dataset_frame(content, ext)
        _, report = analyze_dataset(frame, file.filename or "dataset")
        return report
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
