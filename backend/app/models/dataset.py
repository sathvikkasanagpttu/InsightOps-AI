from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd


@dataclass
class DatasetSession:
    dataset_id: str
    filename: str
    created_at: str
    file_size: int
    sheet_name: Optional[str] = None
    report: Dict[str, Any] = field(default_factory=dict)
    cleaned_path: Optional[Path] = None
    raw_path: Optional[Path] = None


@dataclass
class DatasetBundle:
    dataset_id: str
    filename: str
    frame: pd.DataFrame
    report: Dict[str, Any]
    cleaned_path: Optional[Path]
    raw_path: Optional[Path]
