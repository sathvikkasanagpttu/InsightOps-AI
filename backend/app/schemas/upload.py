from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class PreviewColumn(BaseModel):
    column_name: str
    data_type: str
    semantic_type: str
    confidence: float
    null_percentage: float
    unique_count: int
    sample_values: List[str] = Field(default_factory=list)


class PreviewResponse(BaseModel):
    filename: str
    file_size: int
    delimiter: Optional[str] = None
    encoding: Optional[str] = None
    sheet_names: List[str] = Field(default_factory=list)
    selected_sheet: Optional[str] = None
    columns: List[PreviewColumn]
    preview_rows: List[Dict[str, Any]]
    total_columns: int = 0
    estimated_rows: Optional[int] = None


class RowsResponse(BaseModel):
    dataset_id: str
    page: int
    page_size: int
    total: int
    columns: List[Dict[str, Any]]
    rows: List[Dict[str, Any]]
