import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_dataset_lineage_endpoint():
    res = client.get("/api/datasets/demo-sales/lineage")
    assert res.status_code == 200
    data = res.json()
    assert "nodes" in data
    assert "edges" in data
    assert data["total_nodes"] > 0
    assert data["total_edges"] > 0
    assert any(n["type"] == "source" for n in data["nodes"])
    assert any(n["type"] == "consumer" for n in data["nodes"])


def test_dataset_sensitive_data_endpoint():
    res = client.get("/api/datasets/demo-sales/sensitive-data")
    assert res.status_code == 200
    data = res.json()
    assert "total_columns_scanned" in data
    assert "compliance_score" in data
    assert "findings" in data
    assert data["total_columns_scanned"] > 0
