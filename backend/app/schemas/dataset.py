from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ColumnSchema(BaseModel):
    name: str
    original_name: str
    data_type: str
    semantic_type: str
    confidence: float
    null_percentage: float
    unique_count: int
    sample_values: List[str] = Field(default_factory=list)


class QualityComponents(BaseModel):
    completeness: float
    uniqueness: float
    validity: float
    consistency: float
    type_correctness: float


class MissingColumnDetail(BaseModel):
    column: str
    count: int
    percentage: float


class InvalidValueDetail(BaseModel):
    column: str
    count: int


class QualityReport(BaseModel):
    overall_score: float
    components: QualityComponents
    rows: int
    columns: int
    missing_values: int
    missing_by_column: List[MissingColumnDetail] = Field(default_factory=list)
    duplicate_rows: int
    invalid_values: int
    invalid_by_column: List[InvalidValueDetail] = Field(default_factory=list)


class KPISchema(BaseModel):
    label: str
    value: float
    formatted_value: Optional[str] = None
    format: str = "number"  # "currency", "percent", "number"
    source_columns: List[str] = Field(default_factory=list)
    calculation: str = ""
    trend: Optional[float] = None


class ChartSchema(BaseModel):
    kind: str  # "line", "bar", "pie", "scatter", "area", "histogram"
    title: str
    x_key: str
    y_key: str
    y_label: str
    x_label: Optional[str] = None
    data: List[Dict[str, Any]] = Field(default_factory=list)
    source_columns: List[str] = Field(default_factory=list)


class InsightSchema(BaseModel):
    title: str
    text: str
    source_columns: List[str] = Field(default_factory=list)
    calculation: str
    metric: Optional[str] = None
    result: Optional[str] = None


class AnomalyItem(BaseModel):
    id: str
    title: str
    detail: str
    metric: str
    period: Optional[str] = None
    observed: float
    expected_range: List[float] = Field(default_factory=list)
    deviation: str
    severity: str  # "high", "medium", "low"
    method: str  # "IQR", "Z-score", "Isolation Forest", "Rolling Statistics"
    source_columns: List[str] = Field(default_factory=list)
    explanation: Optional[str] = None
    investigation_details: Optional[Dict[str, Any]] = None


class ForecastDataPoint(BaseModel):
    period: str
    value: float
    lower: Optional[float] = None
    upper: Optional[float] = None


class ForecastResponse(BaseModel):
    available: bool
    reason: Optional[str] = None
    metric: Optional[str] = None
    model_name: Optional[str] = None
    source_columns: List[str] = Field(default_factory=list)
    history: List[Dict[str, Any]] = Field(default_factory=list)
    values: List[ForecastDataPoint] = Field(default_factory=list)
    confidence_interval: Optional[str] = None
    supported_analytics: Optional[List[str]] = None


class DatasetSummaryResponse(BaseModel):
    dataset_id: str
    filename: str
    created_at: Optional[str] = None
    rows: int
    columns: int
    status: str = "analyzed"
    file_size: Optional[int] = None
    quality_score: Optional[float] = None
