from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CleaningStats(BaseModel):
    rows: int
    columns: int
    missing_values: int
    quality_score: Optional[float] = None


class ColumnDiff(BaseModel):
    column: str
    original_type: str
    cleaned_type: str
    whitespace_trimmed: int = 0
    missing_before: int = 0
    missing_after: int = 0
    imputed_count: int = 0
    imputation_strategy: Optional[str] = None
    invalid_coerced: int = 0
    outliers_detected: int = 0


class CleaningReport(BaseModel):
    actions: List[str] = Field(default_factory=list)
    before: CleaningStats
    after: CleaningStats
    diff: List[ColumnDiff] = Field(default_factory=list)
    whitespace_trimmed_by_column: Dict[str, int] = Field(default_factory=dict)
    case_inconsistencies: List[Dict[str, Any]] = Field(default_factory=list)
    duplicate_ids_by_column: List[Dict[str, Any]] = Field(default_factory=list)
    empty_columns: List[str] = Field(default_factory=list)
    constant_columns: List[str] = Field(default_factory=list)
    high_cardinality_columns: List[str] = Field(default_factory=list)
    duplicate_rows_detected: int = 0
    duplicate_rows_removed: int = 0
    invalid_values_by_column: Dict[str, int] = Field(default_factory=dict)
