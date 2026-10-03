import json
import re
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from shutil import rmtree
from typing import Any, Dict, List, Optional

import pandas as pd

from .dataset_engine import analyze_dataset
from .services.ingestion import (
    ALLOWED_EXTENSIONS,
    MAX_UPLOAD_BYTES,
    generate_preview,
    read_dataset_frame,
    safe_filename,
)
from .services.profiling import PII_SEMANTICS, mask_value


DEMO_DATASETS = {
    "demo-sales": {"filename": "sales.csv", "name": "Sales & Revenue", "domain": "Sales"},
    "demo-hr": {"filename": "hr.csv", "name": "HR & Workforce", "domain": "HR"},
    "demo-finance": {"filename": "finance.csv", "name": "Finance & Cash Flow", "domain": "Finance"},
    "demo-ecommerce": {"filename": "ecommerce.csv", "name": "E-Commerce", "domain": "E-commerce"},
    "demo-healthcare": {"filename": "healthcare.csv", "name": "Healthcare & Patients", "domain": "Healthcare"},
    "demo-operations": {"filename": "customer_operations.csv", "name": "Customer Operations", "domain": "Operations"},
}


class DatasetStore:
    def __init__(self, root: Path, demo_path: Path):
        self.root = root.resolve()
        self.demo_path = demo_path.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def upload(self, filename: str | None, content: bytes, sheet_name: str | None = None) -> dict:
        if len(content) > MAX_UPLOAD_BYTES:
            raise ValueError("Files must be 50 MB or smaller.")
        if len(content) == 0:
            raise ValueError("The uploaded file is empty.")

        safe_name = safe_filename(filename)
        extension = Path(safe_name).suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            raise ValueError("Upload a CSV, XLSX or XLS file.")

        frame, encoding, delimiter = read_dataset_frame(content, extension, sheet_name)
        cleaned_frame, report = analyze_dataset(frame, safe_name)

        dataset_id = uuid.uuid4().hex
        report["dataset_id"] = dataset_id
        folder = self._dataset_folder(dataset_id)
        folder.mkdir(parents=True, exist_ok=False)

        (folder / safe_name).write_bytes(content)
        cleaned_frame.to_csv(folder / "cleaned.csv", index=False)

        metadata = {
            "dataset_id": dataset_id,
            "filename": safe_name,
            "name": safe_name,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "file_size": len(content),
            "sheet_name": sheet_name,
            "encoding": encoding,
            "delimiter": delimiter,
            "status": "ready",
            "report": report,
            "transformation_history": [],
        }
        report["file_size"] = len(content)
        report["memory_bytes"] = int(cleaned_frame.memory_usage(index=True, deep=True).sum())
        report["created_at"] = metadata["created_at"]
        report["sheet_name"] = sheet_name
        report["encoding"] = encoding
        report["delimiter"] = delimiter

        (folder / "profile.json").write_text(json.dumps(metadata, ensure_ascii=True), encoding="utf-8")
        return report

    def get(self, dataset_id: str) -> dict:
        return self._load_dataset(dataset_id)

    def list_datasets(self, include_archived: bool = True) -> List[Dict[str, Any]]:
        """
        Lists all uploaded datasets and bundled sample datasets with comprehensive metadata.
        """
        datasets = []
        seen_ids = set()

        # 1. Scan filesystem uploads
        if self.root.is_dir():
            for folder in sorted(self.root.iterdir(), key=lambda p: p.stat().st_mtime if p.is_dir() else 0, reverse=True):
                if not folder.is_dir():
                    continue
                meta_file = folder / "profile.json"
                if not meta_file.is_file():
                    continue
                try:
                    meta = json.loads(meta_file.read_text(encoding="utf-8"))
                    d_id = meta.get("dataset_id") or folder.name
                    if d_id in seen_ids:
                        continue
                    seen_ids.add(d_id)

                    report = meta.get("report", {})
                    status = meta.get("status", "ready")
                    if not include_archived and status == "archived":
                        continue

                    filename = meta.get("filename") or report.get("filename", "dataset.csv")
                    ext = Path(filename).suffix.upper().replace(".", "") or "CSV"
                    q_score = report.get("quality_score") or (report.get("quality") or {}).get("overall_score", 100)

                    datasets.append({
                        "dataset_id": d_id,
                        "name": meta.get("name") or filename,
                        "filename": filename,
                        "file_type": ext,
                        "file_size": meta.get("file_size") or report.get("file_size", 0),
                        "rows": report.get("rows", 0),
                        "columns": report.get("column_count", 0),
                        "quality_score": q_score,
                        "dataset_type": report.get("dataset_type", "Tabular"),
                        "created_at": meta.get("created_at") or datetime.now(timezone.utc).isoformat(),
                        "updated_at": meta.get("updated_at") or meta.get("created_at"),
                        "owner": meta.get("owner", "Workspace Member"),
                        "status": status,
                        "is_demo": False,
                        "transformation_count": len(meta.get("transformation_history", []))
                    })
                except Exception:
                    continue

        # 2. Add bundled sample datasets
        for demo_id, info in DEMO_DATASETS.items():
            demo_file = self.demo_path.parent / info["filename"]
            f_size = demo_file.stat().st_size if demo_file.is_file() else 4096
            datasets.append({
                "dataset_id": demo_id,
                "name": info["name"],
                "filename": info["filename"],
                "file_type": "CSV",
                "file_size": f_size,
                "rows": 200 if demo_id == "demo-sales" else 150,
                "columns": 9 if demo_id == "demo-sales" else 8,
                "quality_score": 100,
                "dataset_type": info["domain"],
                "created_at": "2026-10-01T00:00:00Z",
                "updated_at": "2026-10-01T00:00:00Z",
                "owner": "InsightOps AI Bundled",
                "status": "ready",
                "is_demo": True,
                "transformation_count": 0
            })

        return datasets

    def rename_dataset(self, dataset_id: str, new_name: str) -> Dict[str, Any]:
        if dataset_id in DEMO_DATASETS:
            raise ValueError("Bundled sample datasets cannot be renamed.")
        folder = self._dataset_folder(dataset_id)
        metadata_path = folder / "profile.json"
        if not metadata_path.is_file():
            raise KeyError("Dataset not found.")
        meta = json.loads(metadata_path.read_text(encoding="utf-8"))
        clean_name = new_name.strip()
        meta["name"] = clean_name
        meta["filename"] = clean_name
        if "report" in meta:
            meta["report"]["filename"] = clean_name
        meta["updated_at"] = datetime.now(timezone.utc).isoformat()
        metadata_path.write_text(json.dumps(meta, ensure_ascii=True), encoding="utf-8")
        self._load_dataset.cache_clear()
        return {
            "dataset_id": dataset_id,
            "name": clean_name,
            "filename": clean_name,
            "updated_at": meta["updated_at"]
        }

    def duplicate_dataset(self, dataset_id: str) -> Dict[str, Any]:
        bundle = self.get(dataset_id)
        new_id = uuid.uuid4().hex
        new_folder = self._dataset_folder(new_id)
        new_folder.mkdir(parents=True, exist_ok=False)

        new_filename = f"Copy of {bundle['filename']}"
        raw_bytes = None
        if bundle.get("raw_path") and Path(bundle["raw_path"]).is_file():
            raw_bytes = Path(bundle["raw_path"]).read_bytes()
            (new_folder / new_filename).write_bytes(raw_bytes)
        else:
            bundle["frame"].to_csv(new_folder / new_filename, index=False)

        bundle["frame"].to_csv(new_folder / "cleaned.csv", index=False)

        new_report = dict(bundle["report"])
        new_report["dataset_id"] = new_id
        new_report["filename"] = new_filename

        metadata = {
            "dataset_id": new_id,
            "name": new_filename,
            "filename": new_filename,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "file_size": len(raw_bytes) if raw_bytes else 4096,
            "report": new_report,
            "status": "ready",
            "transformation_history": []
        }
        (new_folder / "profile.json").write_text(json.dumps(metadata, ensure_ascii=True), encoding="utf-8")
        self._load_dataset.cache_clear()
        return new_report

    def archive_dataset(self, dataset_id: str, archive: bool = True) -> Dict[str, Any]:
        if dataset_id in DEMO_DATASETS:
            raise ValueError("Bundled sample datasets cannot be archived.")
        folder = self._dataset_folder(dataset_id)
        metadata_path = folder / "profile.json"
        if not metadata_path.is_file():
            raise KeyError("Dataset not found.")
        meta = json.loads(metadata_path.read_text(encoding="utf-8"))
        meta["status"] = "archived" if archive else "ready"
        meta["updated_at"] = datetime.now(timezone.utc).isoformat()
        metadata_path.write_text(json.dumps(meta, ensure_ascii=True), encoding="utf-8")
        self._load_dataset.cache_clear()
        return {"dataset_id": dataset_id, "status": meta["status"]}

    def reprocess_dataset(self, dataset_id: str) -> Dict[str, Any]:
        if dataset_id in DEMO_DATASETS:
            self._load_dataset.cache_clear()
            return self.get(dataset_id)["report"]
        folder = self._dataset_folder(dataset_id)
        metadata_path = folder / "profile.json"
        if not metadata_path.is_file():
            raise KeyError("Dataset not found.")
        meta = json.loads(metadata_path.read_text(encoding="utf-8"))
        raw_filename = meta["filename"]
        raw_path = folder / raw_filename
        if not raw_path.is_file():
            raw_path = folder / "cleaned.csv"
        content = raw_path.read_bytes()
        ext = raw_path.suffix.lower() or ".csv"
        frame, encoding, delimiter = read_dataset_frame(content, ext, meta.get("sheet_name"))
        cleaned_frame, report = analyze_dataset(frame, raw_filename)
        report["dataset_id"] = dataset_id
        report["file_size"] = len(content)
        cleaned_frame.to_csv(folder / "cleaned.csv", index=False)
        meta["report"] = report
        meta["updated_at"] = datetime.now(timezone.utc).isoformat()
        meta["transformation_history"] = []
        metadata_path.write_text(json.dumps(meta, ensure_ascii=True), encoding="utf-8")
        self._load_dataset.cache_clear()
        return report

    def load_sample(self, sample_name: str) -> Dict[str, Any]:
        clean_name = sample_name.replace(".csv", "").strip().lower()
        matched_file = None
        for demo_id, info in DEMO_DATASETS.items():
            if info["filename"].replace(".csv", "") == clean_name or demo_id == clean_name:
                matched_file = self.demo_path.parent / info["filename"]
                break
        if not matched_file or not matched_file.is_file():
            matched_file = self.demo_path
        content = matched_file.read_bytes()
        return self.upload(matched_file.name, content)

    def apply_transformations(self, dataset_id: str, operations: List[Dict[str, Any]]) -> Dict[str, Any]:
        from .services.cleaning import apply_transformation_pipeline
        bundle = self.get(dataset_id)
        frame = bundle["frame"].copy()

        transformed_df, history, actions = apply_transformation_pipeline(frame, operations)
        cleaned_frame, report = analyze_dataset(transformed_df, bundle["filename"])
        report["dataset_id"] = dataset_id

        if dataset_id not in DEMO_DATASETS:
            folder = self._dataset_folder(dataset_id)
            cleaned_frame.to_csv(folder / "cleaned.csv", index=False)
            metadata_path = folder / "profile.json"
            if metadata_path.is_file():
                meta = json.loads(metadata_path.read_text(encoding="utf-8"))
                existing_hist = meta.get("transformation_history", [])
                meta["transformation_history"] = existing_hist + history
                meta["report"] = report
                meta["updated_at"] = datetime.now(timezone.utc).isoformat()
                metadata_path.write_text(json.dumps(meta, ensure_ascii=True), encoding="utf-8")

        self._load_dataset.cache_clear()
        return {
            "dataset_id": dataset_id,
            "actions": actions,
            "history": history,
            "report": report,
            "total_rows": len(cleaned_frame),
            "total_columns": len(cleaned_frame.columns),
            "quality_score": report.get("quality_score") or (report.get("quality") or {}).get("overall_score", 100)
        }

    def get_transformation_history(self, dataset_id: str) -> List[Dict[str, Any]]:
        if dataset_id in DEMO_DATASETS:
            return []
        folder = self._dataset_folder(dataset_id)
        meta_file = folder / "profile.json"
        if not meta_file.is_file():
            return []
        try:
            meta = json.loads(meta_file.read_text(encoding="utf-8"))
            return meta.get("transformation_history", [])
        except Exception:
            return []

    @lru_cache(maxsize=16)
    def _load_dataset(self, dataset_id: str) -> dict:
        if dataset_id in DEMO_DATASETS:
            filename = DEMO_DATASETS[dataset_id]["filename"]
            demo_file = self.demo_path.parent / filename
            if not demo_file.is_file():
                demo_file = self.demo_path
            frame = self._read_path(demo_file)
            cleaned_frame, report = analyze_dataset(frame, demo_file.name)
            report["dataset_id"] = dataset_id
            return {
                "dataset_id": dataset_id,
                "filename": demo_file.name,
                "frame": cleaned_frame,
                "report": report,
                "cleaned_path": None,
                "raw_path": demo_file
            }

        if not re.fullmatch(r"[a-f0-9]{32}", dataset_id or ""):
            raise KeyError("Dataset not found. Upload a dataset or select the demo dataset.")

        folder = self._dataset_folder(dataset_id)
        metadata_path = folder / "profile.json"
        clean_path = folder / "cleaned.csv"

        if not metadata_path.is_file() or not clean_path.is_file():
            raise KeyError("Dataset not found. It may have expired or been removed.")

        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        report = metadata["report"]
        date_columns = [col["name"] for col in report["schema"] if col["semantic_type"] == "datetime"]
        frame = pd.read_csv(clean_path, parse_dates=date_columns, encoding="utf-8", encoding_errors="replace")
        raw_path = folder / metadata["filename"]

        return {
            "dataset_id": dataset_id,
            "filename": metadata["filename"],
            "frame": frame,
            "report": report,
            "cleaned_path": clean_path,
            "raw_path": raw_path
        }

    def delete(self, dataset_id: str) -> None:
        if dataset_id in DEMO_DATASETS or dataset_id == "demo-sales":
            raise ValueError("The bundled demo dataset cannot be removed.")
        folder = self._dataset_folder(dataset_id)
        if not folder.is_dir():
            raise KeyError("Dataset not found.")
        self._load_dataset.cache_clear()
        rmtree(folder)

    def preview(self, filename: str | None, content: bytes, sheet_name: str | None = None) -> dict:
        return generate_preview(filename, content, sheet_name)

    @classmethod
    def _read_path(cls, path: Path) -> pd.DataFrame:
        try:
            frame, _, _ = read_dataset_frame(path.read_bytes(), path.suffix.lower())
            return frame
        except ValueError:
            raise
        except OSError as exc:
            raise ValueError(f"Could not read dataset file: {exc}") from exc

    def _dataset_folder(self, dataset_id: str) -> Path:
        folder = (self.root / dataset_id).resolve()
        if folder.parent != self.root:
            raise KeyError("Invalid dataset ID.")
        return folder
