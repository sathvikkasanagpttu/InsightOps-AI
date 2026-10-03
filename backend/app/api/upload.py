from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
import pandas as pd

from ..deps import get_bundle, get_store, json_value
from ..services.ingestion import MAX_UPLOAD_BYTES

router = APIRouter(tags=["Upload & Ingestion"])


class RenameDatasetRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class ArchiveDatasetRequest(BaseModel):
    archived: bool = True


class TransformDatasetRequest(BaseModel):
    dataset_id: Optional[str] = None
    operations: List[Dict[str, Any]] = Field(default_factory=list)


def _max_upload_bytes() -> int:
    try:
        from .. import main as m
        return getattr(m, "MAX_UPLOAD_BYTES", MAX_UPLOAD_BYTES)
    except Exception:
        return MAX_UPLOAD_BYTES


@router.get("/api/datasets")
def list_datasets(include_archived: bool = Query(default=True)):
    store = get_store()
    return store.list_datasets(include_archived=include_archived)


@router.post("/api/datasets/load-sample/{sample_name}")
@router.post("/api/datasets/sample/{sample_name}")
def load_sample_dataset(sample_name: str):
    store = get_store()
    try:
        return store.load_sample(sample_name)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not load sample dataset: {exc}") from exc


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
        "name": report["filename"],
        "created_at": report.get("created_at"),
        "rows": report["rows"],
        "columns": report["column_count"],
        "status": "analyzed",
        "quality_score": report.get("quality_score"),
        "file_size": report.get("file_size"),
    }


@router.patch("/api/datasets/{dataset_id}/rename")
def rename_dataset(dataset_id: str, req: RenameDatasetRequest):
    store = get_store()
    try:
        return store.rename_dataset(dataset_id, req.name)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/api/datasets/{dataset_id}/duplicate")
def duplicate_dataset(dataset_id: str):
    store = get_store()
    try:
        return store.duplicate_dataset(dataset_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/api/datasets/{dataset_id}/archive")
def archive_dataset(dataset_id: str, req: ArchiveDatasetRequest = Body(default=ArchiveDatasetRequest())):
    store = get_store()
    try:
        return store.archive_dataset(dataset_id, req.archived)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/api/datasets/{dataset_id}/reprocess")
def reprocess_dataset(dataset_id: str):
    store = get_store()
    try:
        return store.reprocess_dataset(dataset_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/api/datasets/{dataset_id}/transform")
def transform_dataset_path(dataset_id: str, req: TransformDatasetRequest = Body(...)):
    store = get_store()
    try:
        return store.apply_transformations(dataset_id, req.operations)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Transformation failed: {exc}") from exc


@router.post("/api/dataset/transform")
def transform_dataset_query(dataset_id: str = Query(default="demo-sales"), req: TransformDatasetRequest = Body(...)):
    actual_id = req.dataset_id or dataset_id
    store = get_store()
    try:
        return store.apply_transformations(actual_id, req.operations)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Transformation failed: {exc}") from exc


@router.get("/api/datasets/{dataset_id}/transformations")
def get_transformations_path(dataset_id: str):
    store = get_store()
    return store.get_transformation_history(dataset_id)


@router.get("/api/dataset/transformations")
def get_transformations_query(dataset_id: str = Query(default="demo-sales")):
    store = get_store()
    return store.get_transformation_history(dataset_id)


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


class SaveRecipeRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: Optional[str] = None
    operations: List[Dict[str, Any]] = Field(min_length=1)
    workspace_id: Optional[str] = "default-workspace"


@router.get("/api/datasets/recipes")
def list_recipes(
    workspace_id: Optional[str] = "default-workspace"
):
    """List saved, reusable transformation pipelines."""
    from ..db.session import SessionLocal
    from ..db.models import TransformationRecipe
    db = SessionLocal()
    try:
        query = db.query(TransformationRecipe)
        if workspace_id:
            query = query.filter(TransformationRecipe.workspace_id == workspace_id)
        recipes = query.order_by(TransformationRecipe.created_at.desc()).all()
        import json
        return [
            {
                "id": r.id,
                "name": r.name,
                "description": r.description,
                "operations": json.loads(r.pipeline_json),
                "created_at": r.created_at.isoformat()
            }
            for r in recipes
        ]
    finally:
        db.close()


@router.post("/api/datasets/recipes")
def save_recipe(
    req: SaveRecipeRequest
):
    """Saves a transformation pipeline as a reusable recipe."""
    from ..db.session import SessionLocal
    from ..db.models import TransformationRecipe
    import json
    db = SessionLocal()
    try:
        recipe = TransformationRecipe(
            workspace_id=req.workspace_id or "default-workspace",
            user_id="default-user",
            name=req.name,
            description=req.description,
            pipeline_json=json.dumps(req.operations)
        )
        db.add(recipe)
        db.commit()
        return {
            "id": recipe.id,
            "name": recipe.name,
            "description": recipe.description,
            "operations_count": len(req.operations),
            "created_at": recipe.created_at.isoformat(),
            "message": f"Recipe '{recipe.name}' saved successfully."
        }
    finally:
        db.close()


@router.post("/api/datasets/{dataset_id}/apply-recipe/{recipe_id}")
def apply_recipe_to_dataset(
    dataset_id: str,
    recipe_id: str
):
    """Executes a saved recipe on the specified dataset."""
    from ..db.session import SessionLocal
    from ..db.models import TransformationRecipe
    import json
    db = SessionLocal()
    try:
        recipe = db.query(TransformationRecipe).filter(TransformationRecipe.id == recipe_id).first()
        if not recipe:
            raise HTTPException(status_code=404, detail="Transformation recipe not found")
        operations = json.loads(recipe.pipeline_json)
        store = get_store()
        res = store.apply_transformations(dataset_id, operations)
        return {
            "message": f"Successfully applied recipe '{recipe.name}'",
            "actions": res.get("actions", []),
            "report": res.get("report")
        }
    finally:
        db.close()


@router.delete("/api/datasets/recipes/{recipe_id}")
def delete_recipe(recipe_id: str):
    from ..db.session import SessionLocal
    from ..db.models import TransformationRecipe
    db = SessionLocal()
    try:
        recipe = db.query(TransformationRecipe).filter(TransformationRecipe.id == recipe_id).first()
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        db.delete(recipe)
        db.commit()
        return {"message": "Recipe deleted successfully."}
    finally:
        db.close()


class ExecutePipelineRequest(BaseModel):
    operations: List[Dict[str, Any]] = Field(default_factory=list)


@router.post("/api/datasets/{dataset_id}/transform")
def transform_dataset_pipeline(
    dataset_id: str,
    req: ExecutePipelineRequest
):
    """
    Applies an ad-hoc or staged transformation pipeline to the dataset,
    re-profiles the cleaned frame, updates metrics, and returns the audit log.
    """
    store = get_store()
    try:
        res = store.apply_transformations(dataset_id, req.operations)
        return res
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/api/datasets/{dataset_id}/transformation-history")
def get_dataset_transformation_history(dataset_id: str):
    """Returns the transformation history of the dataset."""
    store = get_store()
    return store.get_transformation_history(dataset_id)


