import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_simulator_baseline():
    res = client.get("/api/datasets/demo-sales/decision-simulator/baseline")
    assert res.status_code == 200
    data = res.json()
    assert "baseline" in data
    base = data["baseline"]
    assert base["baseline_revenue"] > 0
    assert base["baseline_volume"] > 0
    assert base["baseline_avg_price"] > 0


def test_simulate_scenario_price_increase():
    payload = {
        "price_change_pct": 10.0,
        "marketing_spend_pct": 0.0,
        "churn_reduction_pct": 0.0,
        "conversion_rate_pct": 0.0,
        "elasticity_model": "moderate"
    }
    res = client.post("/api/datasets/demo-sales/decision-simulator/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "projected" in data
    assert "variance" in data
    assert "waterfall" in data
    assert "sensitivity" in data
    assert "recommendation" in data
    assert len(data["waterfall"]) >= 5
    assert len(data["sensitivity"]["price_curve"]) > 0


def test_simulate_scenario_marketing_surge():
    payload = {
        "price_change_pct": 0.0,
        "marketing_spend_pct": 30.0,
        "churn_reduction_pct": 15.0,
        "conversion_rate_pct": 10.0,
        "elasticity_model": "moderate"
    }
    res = client.post("/api/datasets/demo-sales/decision-simulator/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["projected"]["revenue"] > 0
    assert data["projected"]["marketing_spend"] > data["baseline"]["baseline_marketing_spend"]


def test_saved_scenarios_lifecycle():
    # 1. List
    list_res = client.get("/api/decision-simulator/scenarios?workspace_id=default-workspace")
    assert list_res.status_code == 200
    scenarios = list_res.json()
    assert isinstance(scenarios, list)

    # 2. Save
    save_payload = {
        "name": "Integration Test Scenario",
        "description": "Simulating high conviction price bump",
        "dataset_id": "demo-sales",
        "price_change_pct": 8.0,
        "marketing_spend_pct": 10.0,
        "churn_reduction_pct": 5.0,
        "conversion_rate_pct": 2.0,
        "elasticity_model": "moderate",
        "baseline_metrics": {"revenue": 1000000},
        "projected_metrics": {"revenue": 1080000},
        "variance_summary": {"revenue_delta": 80000}
    }
    create_res = client.post("/api/decision-simulator/scenarios?workspace_id=default-workspace", json=save_payload)
    assert create_res.status_code == 200
    created = create_res.json()
    assert created["name"] == "Integration Test Scenario"
    scenario_id = created["id"]

    # 3. Delete
    del_res = client.delete(f"/api/decision-simulator/scenarios/{scenario_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"
