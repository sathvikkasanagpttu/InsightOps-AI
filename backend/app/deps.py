from pathlib import Path
from fastapi import HTTPException
import pandas as pd

from .dataset_store import DatasetStore

ROOT = Path(__file__).resolve().parents[2]
_default_store = DatasetStore(ROOT / "data" / "uploads", ROOT / "data" / "sample" / "sales.csv")


def get_store() -> DatasetStore:
    try:
        from . import main as m
        if hasattr(m, "store") and m.store is not None:
            return m.store
    except Exception:
        pass
    return _default_store


def get_bundle(dataset_id: str) -> dict:
    store = get_store()
    try:
        return store.get(dataset_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def safe_export_frame(frame: pd.DataFrame) -> pd.DataFrame:
    export_frame = frame.copy()
    for col in export_frame.select_dtypes(include=["object", "string"]).columns:
        export_frame[col] = export_frame[col].map(
            lambda v: f"'{v}" if isinstance(v, str) and v.lstrip().startswith(("=", "+", "-", "@")) else v
        )
    return export_frame


def json_value(value, semantic_type: str):
    if pd.isna(value):
        return None
    if semantic_type in {"email", "phone"}:
        from .services.profiling import mask_value
        return mask_value(value, semantic_type)
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if hasattr(value, "item"):
        return value.item()
    return value if isinstance(value, (str, int, float, bool)) else str(value)
