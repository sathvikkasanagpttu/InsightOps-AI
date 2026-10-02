import pytest
from pathlib import Path
from fastapi.testclient import TestClient
import pandas as pd

from backend.app import main as main_module
from backend.app.dataset_store import DatasetStore

ROOT = Path(__file__).resolve().parents[1]
SAMPLE_DIR = ROOT / "data" / "sample"


@pytest.fixture
def client(tmp_path, monkeypatch):
    store = DatasetStore(tmp_path / "uploads", SAMPLE_DIR / "sales.csv")
    monkeypatch.setattr(main_module, "store", store)
    with TestClient(main_module.app) as test_client:
        yield test_client


def test_visual_query_column_and_bar(client):
    res = client.post("/api/dataset/visualize/query", json={
        "chart_type": "column",
        "x_col": "region",
        "y_col": "revenue",
        "aggregation": "sum",
        "sort_by": "value",
        "sort_order": "desc"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["chart_type"] == "column"
    assert len(data["data"]) > 0
    assert data["data"][0]["value"] >= data["data"][-1]["value"]
    assert "label" in data["data"][0]


def test_visual_query_kpi_card_with_variance_and_sparkline(client):
    res = client.post("/api/dataset/visualize/query", json={
        "chart_type": "kpi_card",
        "y_col": "revenue",
        "aggregation": "sum"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["chart_type"] == "kpi_card"
    assert data["value"] > 0
    assert "sparkline" in data
    assert len(data["sparkline"]) > 0
    assert "target" in data
    assert "achievement_pct" in data


def test_visual_query_cross_filtering(client):
    # Query without cross filter
    unfiltered = client.post("/api/dataset/visualize/query", json={
        "chart_type": "column",
        "x_col": "category",
        "y_col": "revenue",
        "aggregation": "sum"
    }).json()

    # Query with cross filter on region == "South"
    cross_filtered = client.post("/api/dataset/visualize/query", json={
        "chart_type": "column",
        "x_col": "category",
        "y_col": "revenue",
        "aggregation": "sum",
        "cross_filter": {"column": "region", "value": "South"}
    }).json()

    assert cross_filtered["total_rows"] < unfiltered["total_rows"]
    assert sum(d["value"] for d in cross_filtered["data"]) < sum(d["value"] for d in unfiltered["data"])


def test_visual_query_date_hierarchy(client):
    # Month hierarchy
    month_res = client.post("/api/dataset/visualize/query", json={
        "chart_type": "line",
        "x_col": "date",
        "y_col": "revenue",
        "date_hierarchy": "month"
    }).json()
    assert month_res["chart_type"] == "line"
    assert len(month_res["data"]) > 0
    assert "-" in month_res["data"][0]["label"]


def test_visual_query_combo_chart(client):
    res = client.post("/api/dataset/visualize/query", json={
        "chart_type": "combo",
        "x_col": "category",
        "y_col": ["revenue", "profit"],
        "aggregation": "sum"
    }).json()
    assert res["chart_type"] == "combo"
    assert len(res["data"]) > 0
    assert "revenue" in res["data"][0]
    assert "profit" in res["data"][0]


def test_visual_query_stacked_bar(client):
    res = client.post("/api/dataset/visualize/query", json={
        "chart_type": "stacked_bar",
        "x_col": "category",
        "legend_col": "region",
        "y_col": "revenue",
        "aggregation": "sum"
    }).json()
    assert res["chart_type"] == "stacked_bar"
    assert len(res["data"]) > 0
    assert "series" in res
    assert len(res["series"]) > 0


def test_visual_query_heatmap(client):
    res = client.post("/api/dataset/visualize/query", json={
        "chart_type": "heatmap",
        "x_col": "category",
        "legend_col": "region",
        "y_col": "revenue"
    }).json()
    assert res["chart_type"] == "heatmap"
    assert len(res["data"]) > 0
    assert "intensity" in res["data"][0]
    assert "x_categories" in res
    assert "y_categories" in res


def test_visual_query_box_plot(client):
    res = client.post("/api/dataset/visualize/query", json={
        "chart_type": "box_plot",
        "x_col": "category",
        "y_col": "revenue"
    }).json()
    assert res["chart_type"] == "box_plot"
    assert len(res["data"]) > 0
    box = res["data"][0]
    assert "min" in box and "q1" in box and "median" in box and "q3" in box and "max" in box


def test_visual_query_gauge_and_funnel(client):
    gauge = client.post("/api/dataset/visualize/query", json={
        "chart_type": "gauge",
        "y_col": "revenue"
    }).json()
    assert gauge["chart_type"] == "gauge"
    assert gauge["value"] > 0
    assert 0 <= gauge["pct"] <= 100

    funnel = client.post("/api/dataset/visualize/query", json={
        "chart_type": "funnel",
        "x_col": "category",
        "y_col": "revenue"
    }).json()
    assert funnel["chart_type"] == "funnel"
    assert len(funnel["data"]) > 0
    assert funnel["data"][0]["pct_of_first"] == 100.0


def test_visual_query_treemap(client):
    res = client.post("/api/dataset/visualize/query", json={
        "chart_type": "treemap",
        "x_col": "category",
        "y_col": "revenue"
    }).json()
    assert res["chart_type"] == "treemap"
    assert len(res["data"]) > 0
    assert "pct" in res["data"][0]
    assert "formatted" in res["data"][0]
