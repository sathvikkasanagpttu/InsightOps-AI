import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_full_advanced_analytics_endpoint():
    res = client.get("/api/datasets/demo-sales/advanced-analytics")
    assert res.status_code == 200
    data = res.json()
    assert "rfm_segmentation" in data
    assert "cohort_retention" in data
    assert "clv_and_churn" in data
    assert "unit_economics" in data

    # RFM Checks
    rfm = data["rfm_segmentation"]
    assert "segments" in rfm
    assert "summary" in rfm
    assert rfm["summary"]["total_customers"] > 0
    assert rfm["summary"]["total_revenue"] > 0

    # Cohort Checks
    cohorts = data["cohort_retention"]
    assert "cohorts" in cohorts
    assert "average_retention_curve" in cohorts

    # CLV & Churn Checks
    clv = data["clv_and_churn"]
    assert "top_customers" in clv
    assert "risk_breakdown" in clv
    assert clv["summary"]["average_historic_clv"] > 0

    # Unit Economics Checks
    ue = data["unit_economics"]
    assert "metrics" in ue
    assert "summary" in ue
    assert any(m["id"] == "ltv_cac" for m in ue["metrics"])
    assert any(m["id"] == "cac" for m in ue["metrics"])


def test_rfm_dedicated_endpoint():
    res = client.get("/api/datasets/demo-sales/rfm")
    assert res.status_code == 200
    data = res.json()
    assert "segments" in data
    assert len(data["segments"]) > 0
    first_seg = data["segments"][0]
    assert "name" in first_seg
    assert "total_revenue" in first_seg
    assert "action" in first_seg


def test_cohorts_dedicated_endpoint():
    res = client.get("/api/datasets/demo-sales/cohorts")
    assert res.status_code == 200
    data = res.json()
    assert "period_labels" in data
    assert "cohorts" in data


def test_clv_churn_dedicated_endpoint():
    res = client.get("/api/datasets/demo-sales/clv-churn")
    assert res.status_code == 200
    data = res.json()
    assert "top_customers" in data
    assert "summary" in data
    assert "total_at_risk_revenue" in data["summary"]


def test_unit_economics_dedicated_endpoint():
    res = client.get("/api/datasets/demo-sales/unit-economics")
    assert res.status_code == 200
    data = res.json()
    assert "metrics" in data
    assert len(data["metrics"]) >= 5
