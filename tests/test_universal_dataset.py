from io import BytesIO
from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend.app import main as main_module
from backend.app.dataset_engine import analyze_dataset, classify_column
from backend.app.dataset_store import DatasetStore

ROOT = Path(__file__).resolve().parents[1]
CUSTOMER_SAMPLE = ROOT / "data" / "sample" / "customer_operations.csv"
SALES_SAMPLE = ROOT / "data" / "sample" / "sales.csv"


@pytest.fixture
def client(tmp_path, monkeypatch):
    store = DatasetStore(tmp_path / "uploads", SALES_SAMPLE)
    monkeypatch.setattr(main_module, "store", store)
    with TestClient(main_module.app) as test_client:
        yield test_client


def upload(client, filename, content):
    return client.post("/api/dataset/upload", files={"file": (filename, content, "application/octet-stream")})


def uploaded_customer_dataset(client):
    response = upload(client, CUSTOMER_SAMPLE.name, CUSTOMER_SAMPLE.read_bytes())
    assert response.status_code == 200, response.text
    return response.json()


def test_customer_operations_dataset(client, tmp_path):
    report = uploaded_customer_dataset(client)

    assert report["dataset_type"] == "Customer / Lead / Sales Operations"
    assert report["dataset_type_confidence"] == 0.92
    assert report["rows"] == 13
    assert report["column_count"] == 9
    assert report["date_column"] == "created"
    assert report["forecast"]["available"] is True
    assert report["quality"]["duplicate_rows"] == 1
    assert report["quality"]["invalid_values"] >= 3
    assert {item["name"] for item in report["sensitive_columns"]} == {"mobile", "email"}

    semantic_types = {item["name"]: item["semantic_type"] for item in report["schema"]}
    assert semantic_types["created"] == "datetime"
    assert semantic_types["product_id"] == "identifier"
    assert semantic_types["source"] == "source"
    assert semantic_types["sales_agent"] == "person"
    assert semantic_types["region"] == "region"
    assert semantic_types["delivery_mode"] == "delivery_mode"
    assert semantic_types["status"] == "status"

    assert {"Unique Products", "Unique Sales_Agent", "Regions", "Statuses", "Delivery Modes"}.issubset(
        {item["label"] for item in report["kpis"]}
    )
    assert "Total Revenue" not in {item["label"] for item in report["kpis"]}
    assert "lead01@example.test" not in str(report)
    assert "5550101001" not in str(report)

    folder = tmp_path / "uploads" / report["dataset_id"]
    assert (folder / "customer_operations.csv").is_file()
    assert (folder / "cleaned.csv").is_file()
    assert (folder / "profile.json").is_file()


def test_sales_dataset_uses_available_financial_kpis(client):
    report = upload(client, "sales.csv", SALES_SAMPLE.read_bytes()).json()
    assert report["dataset_type"] == "Sales / Revenue"
    assert report["analysis_mode"] == "sales"
    assert not report["sensitive_columns"]
    assert next(item for item in report["schema"] if item["name"] == "revenue")["semantic_type"] == "currency"
    kpis = {item["label"]: item["value"] for item in report["kpis"]}
    assert kpis["Total Revenue"] == pytest.approx(56124429.68)
    assert kpis["Total Orders"] == 50996
    assert kpis["Total Customers"] == 36683
    assert kpis["Average Order Value"] == pytest.approx(1100.57)
    assert "Profit Margin" in kpis
    assert report["forecast"]["metric"] == "revenue"


def test_generic_dataset_is_accepted_without_a_date_or_sales_schema(client):
    content = b"Warehouse,Temperature\nNorth,18.5\nSouth,23.0\nNorth,19.5\n"
    response = upload(client, "measurements.csv", content)

    assert response.status_code == 200
    report = response.json()
    assert report["dataset_type"] == "General Dataset"
    assert report["rows"] == 3
    assert report["forecast"]["available"] is False
    assert report["forecast"]["reason"] == "No usable date column was detected."
    assert "Total Revenue" not in {item["label"] for item in report["kpis"]}


def test_customer_analyst_returns_evidence_and_source_columns(client):
    report = uploaded_customer_dataset(client)
    response = client.post("/api/analyst/ask", json={
        "dataset_id": report["dataset_id"],
        "question": "Which region has the most records?",
    })

    assert response.status_code == 200
    answer = response.json()
    assert "South" in answer["answer"]
    assert answer["source_columns"] == ["region"]
    assert answer["calculation"] == "COUNT(records) grouped by region, sorted descending"
    assert answer["evidence"]


def test_analyst_status_counts_use_uploaded_dataset(client):
    report = uploaded_customer_dataset(client)
    answer = client.post("/api/analyst/ask", json={
        "dataset_id": report["dataset_id"],
        "question": "Show me the status distribution",
    }).json()

    assert "Won" in answer["answer"]
    assert "Open" in answer["answer"]
    assert answer["source_columns"] == ["status"]


def test_dataset_endpoints_are_scoped_by_id(client):
    customer = uploaded_customer_dataset(client)
    generic = upload(client, "generic.csv", b"kind,value\na,1\nb,2\n").json()

    profile = client.get("/api/dataset/profile", params={"dataset_id": customer["dataset_id"]})
    schema = client.get("/api/dataset/schema", params={"dataset_id": customer["dataset_id"]})
    quality = client.get("/api/dataset/quality", params={"dataset_id": customer["dataset_id"]})
    kpis = client.get("/api/dataset/kpis", params={"dataset_id": customer["dataset_id"]})
    insights = client.get("/api/dataset/insights", params={"dataset_id": customer["dataset_id"]})
    charts = client.get("/api/dataset/charts", params={"dataset_id": customer["dataset_id"]})
    forecast = client.get("/api/dataset/forecast", params={"dataset_id": customer["dataset_id"]})
    alerts = client.get("/api/dataset/alerts", params={"dataset_id": customer["dataset_id"]})
    export = client.get("/api/dataset/export-clean", params={"dataset_id": customer["dataset_id"]})

    assert profile.json()["dataset_id"] == customer["dataset_id"]
    assert schema.json()["columns"]
    assert quality.json()["duplicate_rows"] == 1
    assert kpis.json()["dataset_id"] == customer["dataset_id"]
    assert insights.json()
    assert charts.json()
    assert forecast.json()["available"]
    assert alerts.json()
    assert export.status_code == 200
    assert "created,product_id,source" in export.text.splitlines()[0]
    assert client.get("/api/dataset/profile", params={"dataset_id": generic["dataset_id"]}).json()["filename"] == "generic.csv"


def test_unknown_dataset_id_is_not_shared_or_silently_replaced(client):
    response = client.get("/api/dataset/profile", params={"dataset_id": "not-a-dataset"})
    assert response.status_code == 404


def test_excel_xlsx_upload(client):
    output = BytesIO()
    pd.DataFrame({"Created": ["2025-01-01", "2025-02-01"], "Status": ["Open", "Won"]}).to_excel(
        output, index=False, engine="openpyxl"
    )
    response = upload(client, "leads.xlsx", output.getvalue())
    assert response.status_code == 200, response.text
    assert response.json()["date_column"] == "created"


def test_excel_xls_upload(client):
    import xlwt

    workbook = xlwt.Workbook()
    sheet = workbook.add_sheet("Leads")
    for column, value in enumerate(("Created", "Status")):
        sheet.write(0, column, value)
    for row, values in enumerate((("2025-01-01", "Open"), ("2025-02-01", "Won")), start=1):
        for column, value in enumerate(values):
            sheet.write(row, column, value)
    output = BytesIO()
    workbook.save(output)
    response = upload(client, "leads.xls", output.getvalue())
    assert response.status_code == 200, response.text
    assert response.json()["dataset_type"] == "General Dataset"


def test_upload_extension_and_size_limits(client, monkeypatch):
    extension = upload(client, "leads.json", b"{}")
    assert extension.status_code == 400

    monkeypatch.setattr(main_module, "MAX_UPLOAD_BYTES", 8)
    oversized = upload(client, "large.csv", b"x" * 9)
    assert oversized.status_code == 413


def test_sales_demo_compatibility_routes(client):
    assert client.get("/api/health").json()["status"] == "healthy"
    overview = client.get("/api/overview").json()
    assert overview["revenue"] > 0
    assert client.get("/api/dataset/profile").json()["dataset_id"] == "demo-sales"


def test_classifier_uses_column_names_and_values():
    email = classify_column("contact_info", pd.Series(["a@example.test", "b@example.test"]))
    phone = classify_column("reach_me", pd.Series(["+1 555 010 1000", "+1 555 010 1001"]))
    date = classify_column("created_at", pd.Series(["2025-01-01", "2025-02-01"]))
    numeric = classify_column("measurement", pd.Series(["10.5", "12.25"]))

    assert email["semantic_type"] == "email"
    assert phone["semantic_type"] == "phone"
    assert date["semantic_type"] == "datetime"
    assert numeric["semantic_type"] == "numeric"


def test_quality_alerts_include_missing_duplicates_invalid_pii_and_outliers():
    raw = pd.DataFrame({
        "Email": ["ok@example.test", "bad-email", None, "ok@example.test", "x@example.test"],
        "Mobile": ["5550101001", "123", "5550101003", "5550101001", "5550101005"],
        "Metric": [1, 2, 3, 1, 100],
    })
    _, report = analyze_dataset(raw, "quality.csv")
    titles = " ".join(item["title"] for item in report["alerts"])

    assert report["quality"]["missing_values"] == 1
    assert report["quality"]["duplicate_rows"] == 1
    assert report["quality"]["invalid_values"] >= 2
    assert "Missing data" in titles
    assert "Duplicate records" in titles
    assert "Potential outliers" in titles
    assert "Invalid email" in titles
    assert "Invalid phone" in titles
    assert "bad-email" not in str(report)
    assert "5550101001" not in str(report)
