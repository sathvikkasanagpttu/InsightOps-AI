from io import BytesIO
from pathlib import Path
from urllib.parse import quote
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from ..deps import get_bundle, safe_export_frame

router = APIRouter(tags=["Reports & Exports"])


@router.get("/api/datasets/{dataset_id}/report")
def get_dataset_report_by_id(dataset_id: str):
    return get_bundle(dataset_id)["report"]


@router.get("/api/dataset/report")
def get_dataset_report(dataset_id: str = Query(default="demo-sales")):
    return get_bundle(dataset_id)["report"]


def _export_csv(dataset_id: str):
    bundle = get_bundle(dataset_id)
    export_frame = safe_export_frame(bundle["frame"])
    content = export_frame.to_csv(index=False).encode("utf-8-sig")
    filename = Path(bundle["filename"]).stem + "-cleaned.csv"
    return StreamingResponse(
        BytesIO(content),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"}
    )


@router.get("/api/datasets/{dataset_id}/download")
def download_dataset_by_id(dataset_id: str):
    return _export_csv(dataset_id)


@router.get("/api/dataset/export-clean")
def export_clean_dataset(dataset_id: str = Query(default="demo-sales")):
    return _export_csv(dataset_id)


def _export_xlsx(dataset_id: str):
    bundle = get_bundle(dataset_id)
    output = BytesIO()
    safe_export_frame(bundle["frame"]).to_excel(output, index=False, engine="openpyxl")
    filename = Path(bundle["filename"]).stem + "-cleaned.xlsx"
    return StreamingResponse(
        BytesIO(output.getvalue()),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"}
    )


@router.get("/api/datasets/{dataset_id}/download.xlsx")
def download_dataset_xlsx_by_id(dataset_id: str):
    return _export_xlsx(dataset_id)


@router.get("/api/dataset/export-clean.xlsx")
def export_clean_dataset_xlsx(dataset_id: str = Query(default="demo-sales")):
    return _export_xlsx(dataset_id)
