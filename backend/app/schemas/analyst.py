from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AnalystQuestion(BaseModel):
    dataset_id: str = "demo-sales"
    question: str = Field(min_length=1, max_length=1000)


class PathAnalystQuestion(BaseModel):
    question: str = Field(min_length=1, max_length=1000)


class AnalystAnswer(BaseModel):
    question: str
    answer: str
    evidence: List[str] = Field(default_factory=list)
    top_contributor: Optional[Dict[str, Any]] = None
    source_columns: List[str] = Field(default_factory=list)
    calculation: str
    query_intent: Optional[str] = None
