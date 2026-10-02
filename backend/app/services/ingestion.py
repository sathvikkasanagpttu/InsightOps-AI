import csv
from io import BytesIO, StringIO
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from .profiling import PII_SEMANTICS, classify_column, mask_value

MAX_UPLOAD_BYTES = 50 * 1024 * 1024
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}


def safe_filename(filename: Optional[str]) -> str:
    name = Path(filename or "dataset.csv").name
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
    return name or "dataset.csv"


def detect_csv_encoding_and_delimiter(content: bytes) -> Tuple[str, str]:
    if content.startswith(b"\xef\xbb\xbf"):
        detected_encoding = "utf-8-sig"
    elif content.startswith(b"\xff\xfe"):
        detected_encoding = "utf-16-le"
    elif content.startswith(b"\xfe\xff"):
        detected_encoding = "utf-16-be"
    else:
        detected_encoding = "utf-8"
        # Test full content to ensure non-ASCII / Windows-1252 characters anywhere in the file (e.g. 0x96 en-dash) are detected.
        # Order: utf-8-sig, utf-8, cp1252 (preserves Windows ANSI quotes/dashes/euro), latin-1, iso-8859-1, windows-1250, utf-16
        for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1", "iso-8859-1", "windows-1250", "utf-16"):
            try:
                content.decode(encoding)
                detected_encoding = encoding
                break
            except (UnicodeDecodeError, LookupError):
                continue

    text_sample = content[:65536].decode(detected_encoding, errors="replace")
    first_lines = [line for line in text_sample.splitlines() if line.strip()][:10]
    sample_for_sniffer = "\n".join(first_lines)

    detected_delimiter = ","
    try:
        if sample_for_sniffer:
            dialect = csv.Sniffer().sniff(sample_for_sniffer, delimiters=[",", ";", "\t", "|"])
            detected_delimiter = dialect.delimiter
    except Exception:
        # Fallback heuristic: count delimiter frequency in header line
        if first_lines:
            header = first_lines[0]
            counts = {d: header.count(d) for d in (",", ";", "\t", "|")}
            best = max(counts, key=counts.get)
            if counts[best] > 0:
                detected_delimiter = best

    return detected_encoding, detected_delimiter


def read_dataset_frame(
    content: bytes,
    extension: str,
    sheet_name: Optional[str] = None,
    nrows: Optional[int] = None,
) -> Tuple[pd.DataFrame, Optional[str], Optional[str]]:
    """
    Reads dataset content into a pandas DataFrame.
    Returns (DataFrame, detected_encoding, detected_delimiter).
    """
    ext = extension.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError("Upload a CSV, XLSX or XLS file.")

    if ext == ".csv":
        encoding, delimiter = detect_csv_encoding_and_delimiter(content)
        candidate_encodings = [encoding]
        for candidate in ("utf-8-sig", "utf-8", "cp1252", "latin-1", "iso-8859-1", "windows-1250"):
            if candidate not in candidate_encodings:
                candidate_encodings.append(candidate)

        last_error = None
        for enc in candidate_encodings:
            for sep_opt in (delimiter, None):
                try:
                    frame = pd.read_csv(
                        BytesIO(content),
                        sep=sep_opt,
                        engine="python",
                        encoding=enc,
                        encoding_errors="replace",
                        dtype="string",
                        nrows=nrows,
                        on_bad_lines="skip",
                    )
                    return frame, enc, delimiter
                except (UnicodeDecodeError, LookupError) as decode_err:
                    last_error = decode_err
                    break  # Try next encoding
                except Exception as parse_err:
                    last_error = parse_err
                    continue

        raise ValueError(f"Could not read the uploaded CSV file: {last_error}") from last_error

    # Excel formats (.xlsx, .xls)
    engine = "openpyxl" if ext == ".xlsx" else "xlrd"
    try:
        frame = pd.read_excel(
            BytesIO(content),
            sheet_name=sheet_name or 0,
            engine=engine,
            nrows=nrows,
            dtype="string",
        )
        return frame, None, None
    except ImportError as imp_err:
        if "xlrd" in str(imp_err).lower():
            raise ValueError("Reading .xls files requires xlrd. Please install xlrd or upload .xlsx / .csv.")
        raise ValueError(f"Required Excel reader library not available: {imp_err}") from imp_err
    except Exception as exc:
        raise ValueError(f"Could not read the uploaded {ext[1:].upper()} file: {exc}") from exc


def get_excel_sheet_names(content: bytes, extension: str) -> List[str]:
    ext = extension.lower()
    if ext not in {".xlsx", ".xls"}:
        return []
    engine = "openpyxl" if ext == ".xlsx" else "xlrd"
    try:
        excel_file = pd.ExcelFile(BytesIO(content), engine=engine)
        return excel_file.sheet_names
    except ImportError as imp_err:
        if "xlrd" in str(imp_err).lower():
            raise ValueError("Reading .xls files requires xlrd. Please install xlrd or upload .xlsx / .csv.")
        return []
    except Exception as exc:
        raise ValueError(f"Could not inspect sheets in the workbook: {exc}") from exc


def generate_preview(
    filename: Optional[str],
    content: bytes,
    sheet_name: Optional[str] = None,
) -> Dict[str, Any]:
    if len(content) > MAX_UPLOAD_BYTES:
        raise ValueError("Files must be 50 MB or smaller.")
    if len(content) == 0:
        raise ValueError("The uploaded file is empty (0 bytes).")

    safe_name = safe_filename(filename)
    extension = Path(safe_name).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError("Upload a CSV, XLSX or XLS file.")

    sheets = []
    selected_sheet = sheet_name
    if extension in {".xlsx", ".xls"}:
        sheets = get_excel_sheet_names(content, extension)
        if not sheets:
            raise ValueError("The workbook does not contain any sheets.")
        selected_sheet = selected_sheet or sheets[0]
        if selected_sheet not in sheets:
            selected_sheet = sheets[0]

    frame, encoding, delimiter = read_dataset_frame(content, extension, selected_sheet, nrows=15)
    if frame.empty or len(frame.columns) == 0:
        raise ValueError("The uploaded dataset contains no rows or columns.")

    sample_schema = [classify_column(str(column), frame[column]) for column in frame.columns]
    preview_rows = []
    for _, row in frame.head(10).iterrows():
        preview_rows.append({
            str(column): (
                mask_value(row[column], schema["semantic_type"])
                if schema["semantic_type"] in PII_SEMANTICS
                else (str(row[column])[:120] if pd.notna(row[column]) else None)
            )
            for column, schema in zip(frame.columns, sample_schema)
        })

    # Estimate total rows from content size if CSV
    estimated_rows = None
    if extension == ".csv" and len(frame) > 0:
        avg_line_len = max(len(content) // max(len(preview_rows) + 1, 1), 1)
        estimated_rows = max(len(content) // max(len(content[:4096].splitlines()), 1), len(frame))

    return {
        "filename": safe_name,
        "file_size": len(content),
        "delimiter": delimiter,
        "encoding": encoding,
        "sheet_names": sheets,
        "selected_sheet": selected_sheet,
        "columns": sample_schema,
        "total_columns": len(frame.columns),
        "estimated_rows": estimated_rows,
        "preview_rows": preview_rows,
    }
