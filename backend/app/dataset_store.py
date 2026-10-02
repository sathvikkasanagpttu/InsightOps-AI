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
            "created_at": datetime.now(timezone.utc).isoformat(),
            "file_size": len(content),
            "sheet_name": sheet_name,
            "encoding": encoding,
            "delimiter": delimiter,
            "report": report,
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

    @lru_cache(maxsize=16)
    def _load_dataset(self, dataset_id: str) -> dict:
        if dataset_id == "demo-sales":
            frame = self._read_path(self.demo_path)
            cleaned_frame, report = analyze_dataset(frame, self.demo_path.name)
            report["dataset_id"] = dataset_id
            return {
                "dataset_id": dataset_id,
                "filename": self.demo_path.name,
                "frame": cleaned_frame,
                "report": report,
                "cleaned_path": None,
                "raw_path": self.demo_path
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
        if dataset_id == "demo-sales":
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
