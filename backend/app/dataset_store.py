import json
import re
import uuid
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

import pandas as pd

from .dataset_engine import analyze_dataset

MAX_UPLOAD_BYTES = 50 * 1024 * 1024
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}


class DatasetStore:
    def __init__(self, root: Path, demo_path: Path):
        self.root = root.resolve()
        self.demo_path = demo_path.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def upload(self, filename: str | None, content: bytes) -> dict:
        if len(content) > MAX_UPLOAD_BYTES:
            raise ValueError("Files must be 50 MB or smaller.")
        safe_name = self._safe_filename(filename)
        extension = Path(safe_name).suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            raise ValueError("Upload a CSV, XLSX or XLS file.")
        frame = self._read_frame(content, extension)
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
            "report": report,
        }
        (folder / "profile.json").write_text(json.dumps(metadata, ensure_ascii=True), encoding="utf-8")
        return report

    def get(self, dataset_id: str) -> dict:
        if dataset_id == "demo-sales":
            frame = self._read_path(self.demo_path)
            cleaned_frame, report = analyze_dataset(frame, self.demo_path.name)
            report["dataset_id"] = dataset_id
            return {"dataset_id": dataset_id, "filename": self.demo_path.name,
                    "frame": cleaned_frame, "report": report,
                    "cleaned_path": None, "raw_path": self.demo_path}
        if not re.fullmatch(r"[a-f0-9]{32}", dataset_id or ""):
            raise KeyError("Dataset not found. Upload a dataset or select the demo dataset.")
        folder = self._dataset_folder(dataset_id)
        metadata_path = folder / "profile.json"
        clean_path = folder / "cleaned.csv"
        if not metadata_path.is_file() or not clean_path.is_file():
            raise KeyError("Dataset not found. It may have expired or been removed.")
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        report = metadata["report"]
        date_columns = [column["name"] for column in report["schema"] if column["semantic_type"] == "datetime"]
        frame = pd.read_csv(clean_path, parse_dates=date_columns)
        raw_path = folder / metadata["filename"]
        return {"dataset_id": dataset_id, "filename": metadata["filename"],
                "frame": frame, "report": report, "cleaned_path": clean_path,
                "raw_path": raw_path}

    @staticmethod
    def _read_frame(content: bytes, extension: str) -> pd.DataFrame:
        try:
            if extension == ".csv":
                return pd.read_csv(BytesIO(content), sep=None, engine="python", encoding="utf-8-sig", dtype="string")
            return pd.read_excel(BytesIO(content), engine="openpyxl" if extension == ".xlsx" else "xlrd")
        except Exception as exc:
            raise ValueError(f"Could not read the uploaded {extension[1:].upper()} file: {exc}") from exc

    @classmethod
    def _read_path(cls, path: Path) -> pd.DataFrame:
        try:
            return cls._read_frame(path.read_bytes(), path.suffix.lower())
        except ValueError:
            raise
        except OSError as exc:
            raise ValueError(f"Could not read dataset: {exc}") from exc

    def _dataset_folder(self, dataset_id: str) -> Path:
        folder = (self.root / dataset_id).resolve()
        if folder.parent != self.root:
            raise KeyError("Invalid dataset ID.")
        return folder

    @staticmethod
    def _safe_filename(filename: str | None) -> str:
        name = Path(filename or "dataset.csv").name
        name = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
        return name or "dataset.csv"
