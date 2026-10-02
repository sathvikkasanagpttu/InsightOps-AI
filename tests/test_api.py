from fastapi.testclient import TestClient
import sys
sys.path.insert(0, "backend")
from app.main import app
client = TestClient(app)

def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"

def test_overview():
    r = client.get("/api/overview")
    assert r.status_code == 200
    assert r.json()["revenue"] > 0
