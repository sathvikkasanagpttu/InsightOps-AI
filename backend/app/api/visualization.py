from __future__ import annotations
from typing import Any, Dict, List, Optional, Union
from fastapi import APIRouter, Query, Body, HTTPException
from pydantic import BaseModel, Field

from ..deps import get_bundle
from ..services.visual_query import execute_visual_query

router = APIRouter(tags=["Visualizations"])


class VisualQueryRequest(BaseModel):
    chart_type: str = Field(default="column", description="Visual type (column, bar, stacked_bar, line, area, combo, pie, donut, treemap, scatter, bubble, histogram, box_plot, heatmap, funnel, gauge, kpi_card, table)")
    x_col: Optional[str] = None
    y_col: Optional[Union[str, List[str]]] = None
    legend_col: Optional[str] = None
    size_col: Optional[str] = None
    aggregation: str = "sum"
    date_hierarchy: str = "auto"
    filters: Optional[List[Dict[str, Any]]] = None
    cross_filter: Optional[Dict[str, Any]] = None
    sort_by: str = "value"
    sort_order: str = "desc"
    top_n: Optional[int] = None


@router.get("/api/datasets/{dataset_id}/visualizations")
def get_dataset_visualizations_by_id(dataset_id: str):
    return get_bundle(dataset_id)["report"]["charts"]


@router.get("/api/dataset/charts")
def get_dataset_charts(dataset_id: str = Query(default="demo-sales")):
    return get_bundle(dataset_id)["report"]["charts"]


@router.post("/api/datasets/{dataset_id}/visualize/query")
def query_visual_by_id(dataset_id: str, query: VisualQueryRequest):
    bundle = get_bundle(dataset_id)
    clean_frame = bundle.get("frame") if "frame" in bundle else bundle.get("clean_frame")
    return execute_visual_query(
        frame=clean_frame,
        chart_type=query.chart_type,
        x_col=query.x_col,
        y_col=query.y_col,
        legend_col=query.legend_col,
        size_col=query.size_col,
        aggregation=query.aggregation,
        date_hierarchy=query.date_hierarchy,
        filters=query.filters,
        cross_filter=query.cross_filter,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
        top_n=query.top_n,
    )


@router.post("/api/dataset/visualize/query")
def query_visual_by_param(query: VisualQueryRequest, dataset_id: str = Query(default="demo-sales")):
    bundle = get_bundle(dataset_id)
    clean_frame = bundle.get("frame") if "frame" in bundle else bundle.get("clean_frame")
    return execute_visual_query(
        frame=clean_frame,
        chart_type=query.chart_type,
        x_col=query.x_col,
        y_col=query.y_col,
        legend_col=query.legend_col,
        size_col=query.size_col,
        aggregation=query.aggregation,
        date_hierarchy=query.date_hierarchy,
        filters=query.filters,
        cross_filter=query.cross_filter,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
        top_n=query.top_n,
    )


@router.get("/api/trends")
def trends(dataset_id: str = Query(default="demo-sales")):
    return get_bundle(dataset_id)["report"]["time_series"]


@router.get("/api/categories")
def categories(dataset_id: str = Query(default="demo-sales")):
    return [
        item for item in get_bundle(dataset_id)["report"]["dimensions"]
        if item["semantic_type"] in {"category", "status", "source", "delivery_mode"}
    ]


@router.get("/api/regions")
def regions(dataset_id: str = Query(default="demo-sales")):
    return [
        item for item in get_bundle(dataset_id)["report"]["dimensions"]
        if item["semantic_type"] in {"region", "location"}
    ]
