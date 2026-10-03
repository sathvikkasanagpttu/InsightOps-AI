import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_analyst_conversations_flow():
    # 1. List conversations (should include welcome thread)
    list_res = client.get("/api/analyst/conversations?workspace_id=default-workspace")
    assert list_res.status_code == 200
    convs = list_res.json()
    assert isinstance(convs, list)
    assert len(convs) >= 1

    # 2. Create new thread
    create_res = client.post("/api/analyst/conversations?workspace_id=default-workspace", json={
        "title": "Quarterly Margin Deep Dive",
        "dataset_id": "demo-sales"
    })
    assert create_res.status_code == 200
    created = create_res.json()
    thread_id = created["id"]
    assert created["title"] == "Quarterly Margin Deep Dive"

    # 3. Send message turn
    msg_res = client.post(f"/api/analyst/conversations/{thread_id}/messages", json={
        "content": "Which category delivered the highest profit margin?"
    })
    assert msg_res.status_code == 200
    asst_data = msg_res.json()["assistant_message"]
    assert asst_data["role"] == "assistant"
    assert asst_data["content"]
    assert "evidence" in asst_data
    assert "follow_ups" in asst_data
    assert len(asst_data["follow_ups"]) > 0

    # 4. Fetch full thread history
    hist_res = client.get(f"/api/analyst/conversations/{thread_id}")
    assert hist_res.status_code == 200
    hist = hist_res.json()
    assert len(hist["messages"]) >= 2
    assert hist["messages"][0]["role"] == "user"
    assert hist["messages"][1]["role"] == "assistant"

    # 5. Delete thread
    del_res = client.delete(f"/api/analyst/conversations/{thread_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"
