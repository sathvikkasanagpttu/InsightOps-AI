import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from backend.app import main as main_module
from backend.app.dataset_store import DatasetStore

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.db.session import Base, get_db
from backend.app.db.init_db import init_db

ROOT = Path(__file__).resolve().parents[1]
SAMPLE_DIR = ROOT / "data" / "sample"


@pytest.fixture
def client(tmp_path, monkeypatch):
    test_db_file = tmp_path / "test_saas.db"
    test_engine = create_engine(f"sqlite:///{test_db_file}", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    init_db(target_engine=test_engine, target_session_factory=TestingSessionLocal)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    main_module.app.dependency_overrides[get_db] = override_get_db

    store = DatasetStore(tmp_path / "uploads", SAMPLE_DIR / "sales.csv")
    monkeypatch.setattr(main_module, "store", store)
    with TestClient(main_module.app) as test_client:
        yield test_client

    main_module.app.dependency_overrides.clear()


def test_auth_signup_login_and_me_flow(client):
    # 1. Sign up new user
    signup_res = client.post("/api/auth/signup", json={
        "email": "testuser@example.com",
        "password": "StrongPassword123!",
        "full_name": "Test User",
        "workspace_name": "Test Workspace"
    })
    assert signup_res.status_code == 200
    data = signup_res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == "testuser@example.com"
    token = data["access_token"]
    ws_id = data["user"]["active_workspace_id"]
    assert ws_id is not None

    # 2. Get /me
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == "testuser@example.com"
    assert len(me_data["workspaces"]) >= 1

    # 3. Login
    login_res = client.post("/api/auth/login", json={
        "email": "testuser@example.com",
        "password": "StrongPassword123!"
    })
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "access_token" in login_data

    # 4. Refresh token
    refresh_res = client.post("/api/auth/refresh", json={
        "refresh_token": data["refresh_token"]
    })
    assert refresh_res.status_code == 200
    assert "access_token" in refresh_res.json()


def test_auth_password_reset_flow(client):
    # Forgot password
    forgot_res = client.post("/api/auth/forgot-password", json={
        "email": "admin@insightops.ai"
    })
    assert forgot_res.status_code == 200
    reset_token = forgot_res.json().get("reset_token")
    assert reset_token is not None

    # Reset password
    reset_res = client.post("/api/auth/reset-password", json={
        "token": reset_token,
        "new_password": "NewAdminPassword123!"
    })
    assert reset_res.status_code == 200

    # Login with new password
    login_res = client.post("/api/auth/login", json={
        "email": "admin@insightops.ai",
        "password": "NewAdminPassword123!"
    })
    assert login_res.status_code == 200


def test_workspaces_crud_and_rbac(client):
    # Login as admin
    login_res = client.post("/api/auth/login", json={
        "email": "admin@insightops.ai",
        "password": "Password123!"
    })
    token = login_res.json()["access_token"]
    auth_header = {"Authorization": f"Bearer {token}"}

    # List workspaces
    ws_list = client.get("/api/workspaces", headers=auth_header).json()
    assert len(ws_list) >= 1

    # Create workspace
    new_ws = client.post("/api/workspaces", headers=auth_header, json={
        "name": "Finance & Operations",
        "description": "Enterprise financial analysis workspace"
    }).json()
    assert new_ws["name"] == "Finance & Operations"
    ws_id = new_ws["id"]

    # Add member
    add_mem = client.post(f"/api/workspaces/{ws_id}/members", headers=auth_header, json={
        "email": "analyst@example.com",
        "role": "Analyst"
    })
    assert add_mem.status_code == 200

    # List members
    members = client.get(f"/api/workspaces/{ws_id}/members", headers=auth_header).json()
    assert any(m["email"] == "analyst@example.com" for m in members)


def test_reports_crud_duplicate_and_share(client):
    login_res = client.post("/api/auth/login", json={
        "email": "admin@insightops.ai",
        "password": "Password123!"
    })
    token = login_res.json()["access_token"]
    auth_header = {"Authorization": f"Bearer {token}"}

    # Create report
    rep = client.post("/api/reports", headers=auth_header, json={
        "workspace_id": "default-workspace",
        "title": "Quarterly Performance Report",
        "description": "Executive review with 3 pages",
        "pages": [
            {"id": "p1", "title": "Overview", "visuals": []},
            {"id": "p2", "title": "Regional Breakdown", "visuals": []}
        ],
        "schedule_frequency": "weekly"
    }).json()
    assert rep["title"] == "Quarterly Performance Report"
    rep_id = rep["id"]

    # Duplicate report
    dup = client.post(f"/api/reports/{rep_id}/duplicate", headers=auth_header).json()
    assert "Copy" in dup["title"]

    # Share report
    share_res = client.post(f"/api/reports/{rep_id}/share", headers=auth_header, json={
        "is_shared": True,
        "share_role": "Viewer"
    })
    assert share_res.status_code == 200

    # Get report publicly or as member
    get_rep = client.get(f"/api/reports/{rep_id}").json()
    assert get_rep["is_shared"] is True
    assert len(get_rep["pages"]) == 2

    # List reports across all accessible workspaces (verifying in_ filter)
    all_reports = client.get("/api/reports", headers=auth_header).json()
    assert isinstance(all_reports, list)
    assert any(r["id"] == rep_id for r in all_reports)


def test_alerts_center_and_notifications(client):
    login_res = client.post("/api/auth/login", json={
        "email": "admin@insightops.ai",
        "password": "Password123!"
    })
    token = login_res.json()["access_token"]
    auth_header = {"Authorization": f"Bearer {token}"}

    # List rules
    rules = client.get("/api/alerts").json()
    assert len(rules) >= 1

    # Create alert rule
    new_alert = client.post("/api/alerts", headers=auth_header, json={
        "workspace_id": "default-workspace",
        "name": "High Volume Alert",
        "alert_type": "threshold",
        "metric_column": "revenue",
        "condition": "gt",
        "threshold_value": 500000.0,
        "severity": "high",
        "delivery_channel": "both",
        "schedule": "daily"
    }).json()
    assert new_alert["name"] == "High Volume Alert"

    # Toggle alert
    toggle = client.post(f"/api/alerts/{new_alert['id']}/toggle", headers=auth_header).json()
    assert toggle["is_active"] is False

    # Check triggered notifications
    notifs = client.get("/api/alerts/notifications?dataset_id=demo-sales").json()
    assert isinstance(notifs, list)


def test_activity_logs_and_global_search(client):
    # Activity logs
    logs = client.get("/api/activity").json()
    assert len(logs) >= 1
    assert "action" in logs[0]
    assert "description" in logs[0]

    # Global search
    search = client.get("/api/search?q=sales").json()
    assert "results" in search
    assert "total_matches" in search


def test_system_developer_health(client):
    health = client.get("/api/system/health").json()
    assert health["status"] == "healthy"
    assert health["database"]["status"] == "healthy"
    assert health["database"]["tables"]["users"] >= 1
    assert health["database"]["tables"]["workspaces"] >= 1
    assert "uptime_seconds" in health["system"]


def test_dataset_lifecycle_and_interactive_cleaning(client):
    # 1. List datasets
    datasets = client.get("/api/datasets").json()
    assert isinstance(datasets, list)
    assert len(datasets) >= 1
    assert any(d["dataset_id"] == "demo-sales" for d in datasets)

    # 2. Load sample dataset
    load_res = client.post("/api/datasets/load-sample/hr")
    assert load_res.status_code == 200
    hr_data = load_res.json()
    ds_id = hr_data["dataset_id"]
    assert ds_id != "demo-sales"

    # 3. Rename dataset
    rename_res = client.patch(f"/api/datasets/{ds_id}/rename", json={"name": "Workforce Analytics 2026.csv"})
    assert rename_res.status_code == 200
    assert rename_res.json()["name"] == "Workforce Analytics 2026.csv"

    # 4. Duplicate dataset
    dup_res = client.post(f"/api/datasets/{ds_id}/duplicate")
    assert dup_res.status_code == 200
    dup_id = dup_res.json()["dataset_id"]
    assert dup_id != ds_id

    # 5. Archive and Unarchive
    arch_res = client.post(f"/api/datasets/{ds_id}/archive", json={"archived": True})
    assert arch_res.status_code == 200
    assert arch_res.json()["status"] == "archived"

    unarch_res = client.post(f"/api/datasets/{ds_id}/archive", json={"archived": False})
    assert unarch_res.status_code == 200
    assert unarch_res.json()["status"] == "ready"

    # 6. Interactive Transformation pipeline
    transform_res = client.post(f"/api/datasets/{ds_id}/transform", json={
        "operations": [
            {"type": "rename_column", "old_name": "department", "new_name": "dept_division"},
            {"type": "filter_rows", "column": "salary", "operator": "gt", "value": 30000},
            {"type": "calculated_column", "new_column": "bonus_est", "col1": "salary", "operator": "*", "value": 0.1}
        ]
    })
    assert transform_res.status_code == 200
    t_data = transform_res.json()
    assert "actions" in t_data
    assert len(t_data["actions"]) >= 2
    assert "dept_division" in [c["name"] for c in t_data["report"]["schema"]]
    assert "bonus_est" in [c["name"] for c in t_data["report"]["schema"]]

    # 7. Get transformation history
    hist = client.get(f"/api/datasets/{ds_id}/transformations").json()
    assert isinstance(hist, list)
    assert len(hist) >= 1

    # 8. Clean up
    del_res = client.delete(f"/api/datasets/{ds_id}")
    assert del_res.status_code == 200
    client.delete(f"/api/datasets/{dup_id}")


def test_api_keys_and_notification_settings(client):
    # 1. Sign in as admin
    login_res = client.post("/api/auth/login", json={
        "email": "admin@insightops.ai",
        "password": "Password123!"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create API key
    key_res = client.post("/api/auth/api-keys", json={"name": "ETL Ingestion Token"}, headers=headers)
    assert key_res.status_code == 200
    key_data = key_res.json()
    assert "token" in key_data
    assert key_data["token"].startswith("iop_live_")
    key_id = key_data["id"]

    # 3. List API keys
    list_res = client.get("/api/auth/api-keys", headers=headers)
    assert list_res.status_code == 200
    assert any(k["id"] == key_id for k in list_res.json())

    # 4. Authenticate using the generated API Key
    api_key_headers = {"Authorization": f"Bearer {key_data['token']}"}
    me_res = client.get("/api/auth/me", headers=api_key_headers)
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "admin@insightops.ai"

    # 5. Get and update notification settings
    notif_get = client.get("/api/auth/notification-settings", headers=headers)
    assert notif_get.status_code == 200

    notif_put = client.put("/api/auth/notification-settings", json={
        "slack_webhook_url": "https://hooks.slack.com/services/T00/B00/X00",
        "email_enabled": True,
        "frequency": "daily"
    }, headers=headers)
    assert notif_put.status_code == 200
    assert notif_put.json()["frequency"] == "daily"
    assert notif_put.json()["slack_webhook_url"] == "https://hooks.slack.com/services/T00/B00/X00"

    # 6. Revoke API key
    del_key = client.delete(f"/api/auth/api-keys/{key_id}", headers=headers)
    assert del_key.status_code == 200

    # 7. Verify revoked key no longer authenticates
    fail_me = client.get("/api/auth/me", headers=api_key_headers)
    assert fail_me.status_code == 401


