import json
import re
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from shutil import rmtree

import pandas as pd

from .dataset_engine import PII_SEMANTICS, _mask_value, analyze_dataset, classify_column

MAX_UPLOAD_BYTES = 50 * 1024 * 1024
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}


class DatasetStore:
    def __init__(self, root: Path, demo_path: Path):
        self.root = root.resolve()
        self.demo_path = demo_path.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def upload(self, filename: str | None, content: bytes, sheet_name: str | None = None) -> dict:
        if len(content) > MAX_UPLOAD_BYTES:
            raise ValueError("Files must be 50 MB or smaller.")
        safe_name = self._safe_filename(filename)
        extension = Path(safe_name).suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            raise ValueError("Upload a CSV, XLSX or XLS file.")
        frame = self._read_frame(content, extension, sheet_name)
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
            "report": report,
        }
        report["file_size"] = len(content)
        report["memory_bytes"] = int(cleaned_frame.memory_usage(index=True, deep=True).sum())
        report["created_at"] = metadata["created_at"]
        report["sheet_name"] = sheet_name
        (folder / "profile.json").write_text(json.dumps(metadata, ensure_ascii=True), encoding="utf-8")
        return report

    def get(self, dataset_id: str) -> dict:
        return self._load_dataset(dataset_id)

    @lru_cache(maxsize=4)
    def _load_dataset(self, dataset_id: str) -> dict:
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

    def delete(self, dataset_id: str) -> None:
        if dataset_id == "demo-sales":
            raise ValueError("The bundled demo dataset cannot be removed.")
        folder = self._dataset_folder(dataset_id)
        if not folder.is_dir():
            raise KeyError("Dataset not found.")
        self._load_dataset.cache_clear()
        rmtree(folder)

    def preview(self, filename: str | None, content: bytes, sheet_name: str | None = None) -> dict:
        if len(content) > MAX_UPLOAD_BYTES:
            raise ValueError("Files must be 50 MB or smaller.")
        safe_name = self._safe_filename(filename)
        extension = Path(safe_name).suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            raise ValueError("Upload a CSV, XLSX or XLS file.")
        sheets = []
        selected_sheet = sheet_name
        if extension in {".xlsx", ".xls"}:
            engine = "openpyxl" if extension == ".xlsx" else "xlrd"
            try:
                sheets = pd.ExcelFile(BytesIO(content), engine=engine).sheet_names
            except Exception as exc:
                raise ValueError(f"Could not read the uploaded workbook: {exc}") from exc
            if not sheets:
                raise ValueError("The workbook does not contain any sheets.")
            selected_sheet = selected_sheet or sheets[0]
            if selected_sheet not in sheets:
                raise ValueError("Select a sheet name present in the uploaded workbook.")
        frame = self._read_frame(content, extension, selected_sheet, nrows=12)
        sample_schema = [classify_column(str(column), frame[column]) for column in frame.columns]
        preview_rows = []
        for _, row in frame.head(10).iterrows():
            preview_rows.append({
                str(column): (_mask_value(row[column], schema["semantic_type"])
                              if schema["semantic_type"] in PII_SEMANTICS else str(row[column])[:120])
                for column, schema in zip(frame.columns, sample_schema)
            })
        return {"filename": safe_name, "file_size": len(content), "sheet_names": sheets,
                "selected_sheet": selected_sheet, "columns": sample_schema,
                "preview_rows": preview_rows}

    @staticmethod
    def _read_frame(content: bytes, extension: str, sheet_name: str | None = None,
                    nrows: int | None = None) -> pd.DataFrame:
        try:
            if extension == ".csv":
                decode_error = None
                for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
                    try:
                        return pd.read_csv(BytesIO(content), sep=None, engine="python",
                                           encoding=encoding, dtype="string", nrows=nrows)
                    except UnicodeDecodeError as exc:
                        decode_error = exc
                raise ValueError(f"Could not detect a supported CSV encoding: {decode_error}")
            return pd.read_excel(BytesIO(content), sheet_name=sheet_name or 0,
                                 engine="openpyxl" if extension == ".xlsx" else "xlrd",
                                 nrows=nrows, dtype="string")
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
