import io
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

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


def upload_sample(client, filename):
    filepath = SAMPLE_DIR / filename
    assert filepath.is_file(), f"Sample file {filename} not found"
    content = filepath.read_bytes()
    response = client.post(
        "/api/datasets/upload",
        files={"file": (filename, content, "application/octet-stream")}
    )
    assert response.status_code == 200, f"Upload failed for {filename}: {response.text}"
    return response.json()


def test_acceptance_dataset_a_sales(client):
    """
    Dataset A: Sales
    date, product/category, region, revenue, quantity/orders, profit
    Expected:
    - Revenue KPI
    - Profit KPI
    - Sales trend
    - Category chart
    - Regional chart
    - Forecast
    - Anomalies
    """
    report = upload_sample(client, "sales.csv")
    dataset_id = report["dataset_id"]

    # 1. KPIs
    kpi_res = client.get(f"/api/datasets/{dataset_id}/kpis")
    assert kpi_res.status_code == 200
    kpis = {k["label"]: k for k in kpi_res.json()["kpis"]}
    assert "Total Revenue" in kpis
    assert "Total Profit" in kpis
    assert kpis["Total Revenue"]["value"] > 0
    assert kpis["Total Profit"]["value"] > 0
    # Traceability
    assert kpis["Total Revenue"]["source_columns"] == ["revenue"]
    assert kpis["Total Revenue"]["calculation"]

    # 2. Visualizations
    viz_res = client.get(f"/api/datasets/{dataset_id}/visualizations")
    assert viz_res.status_code == 200
    charts = viz_res.json()
    chart_titles = [c["title"].lower() for c in charts]
    assert any("trend" in t or "revenue" in t for t in chart_titles)
    assert any("category" in t for t in chart_titles)
    assert any("region" in t for t in chart_titles)

    # 3. Forecast
    fc_res = client.get(f"/api/datasets/{dataset_id}/forecast")
    assert fc_res.status_code == 200
    fc = fc_res.json()
    assert fc["available"] is True
    assert fc["metric"] == "revenue"
    assert len(fc["values"]) > 0
    assert "lower" in fc["values"][0] and "upper" in fc["values"][0]

    # 4. Anomalies
    anom_res = client.get(f"/api/datasets/{dataset_id}/anomalies")
    assert anom_res.status_code == 200
    anomalies = anom_res.json()
    assert isinstance(anomalies, list)


def test_acceptance_dataset_b_hr(client):
    """
    Dataset B: HR
    employee_id, age, department, salary, experience, attrition, hire_date, location
    Expected:
    - Employee count
    - Average salary
    - Department analysis
    - Age distribution
    - Attrition analysis
    - Salary distribution
    """
    report = upload_sample(client, "hr.csv")
    dataset_id = report["dataset_id"]

    # 1. KPIs
    kpi_res = client.get(f"/api/datasets/{dataset_id}/kpis")
    assert kpi_res.status_code == 200
    kpis = {k["label"]: k for k in kpi_res.json()["kpis"]}
    assert "Employees" in kpis
    assert "Average Salary" in kpis
    assert "Departments" in kpis
    assert "Attrition Rate" in kpis
    assert kpis["Employees"]["value"] == 12
    assert kpis["Average Salary"]["value"] > 0

    # 2. Visualizations
    viz_res = client.get(f"/api/datasets/{dataset_id}/visualizations")
    assert viz_res.status_code == 200
    charts = viz_res.json()
    chart_titles = [c["title"].lower() for c in charts]
    assert any("department" in t for t in chart_titles)
    assert any("age" in t or "salary" in t for t in chart_titles)

    # 3. AI Analyst query on HR dataset
    ask_res = client.post(f"/api/datasets/{dataset_id}/ask", json={"question": "What is the average salary?"})
    assert ask_res.status_code == 200
    ans = ask_res.json()
    assert "Average" in ans["answer"] or "salary" in ans["answer"].lower()
    assert "salary" in ans["source_columns"]
    assert "AVG(salary)" in ans["calculation"]


def test_acceptance_dataset_c_ecommerce(client):
    """
    Dataset C: E-commerce
    order_id, customer_id, product, price, quantity, order_date, country
    Expected:
    - Orders
    - Customers
    - Revenue (derived from price * quantity)
    - AOV
    - Product analysis
    - Country analysis
    - Time trend
    """
    report = upload_sample(client, "ecommerce.csv")
    dataset_id = report["dataset_id"]

    # 1. KPIs
    kpi_res = client.get(f"/api/datasets/{dataset_id}/kpis")
    assert kpi_res.status_code == 200
    kpis = {k["label"]: k for k in kpi_res.json()["kpis"]}
    assert "Total Orders" in kpis
    assert "Unique Customers" in kpis
    assert "Total Revenue" in kpis
    assert "Average Order Value" in kpis
    assert kpis["Total Revenue"]["value"] == pytest.approx(1023.5)
    assert kpis["Total Revenue"]["source_columns"] == ["price", "quantity"]

    # 2. Visualizations
    viz_res = client.get(f"/api/datasets/{dataset_id}/visualizations")
    assert viz_res.status_code == 200
    charts = viz_res.json()
    chart_titles = [c["title"].lower() for c in charts]
    assert any("product" in t for t in chart_titles)
    assert any("country" in t for t in chart_titles)

    # 3. AI Analyst query on E-commerce
    ask_res = client.post(f"/api/datasets/{dataset_id}/ask", json={"question": "What is the top product?"})
    assert ask_res.status_code == 200
    ans = ask_res.json()
    assert "product" in ans["source_columns"]


def test_all_sample_domains_ingested_and_classified(client):
    samples = {
        "finance.csv": "Finance",
        "healthcare.csv": "Healthcare",
        "customer_operations.csv": "Customer / Lead / Sales Operations",
    }
    for filename, expected_domain in samples.items():
        report = upload_sample(client, filename)
        assert report["dataset_type"] == expected_domain
        assert report["rows"] > 0
        assert len(report["kpis"]) >= 4
        assert len(report["charts"]) >= 1
        assert len(report["insights"]) >= 1


def test_cleaning_pipeline_and_diff_report(client):
    dirty_content = (
        b"ID, Name , Created Date , Price , Inactive\n"
        b"1, Widget A , 2025-01-01 , $1,200.50 , false\n"
        b"2, Widget B, 2025-01-02 , 850 , true\n"
        b"1, Widget A , 2025-01-01 , $1,200.50 , false\n"  # Duplicate row
        b"3, , invalid-date , (50) , 0\n"  # Missing name, invalid date, parenthesized negative
    )
    res = client.post(
        "/api/datasets/upload",
        files={"file": ("dirty_test.csv", dirty_content, "text/csv")}
    )
    assert res.status_code == 200
    report = res.json()
    cleaning = report["cleaning_report"]

    assert cleaning["duplicate_rows_detected"] == 1
    assert any("trimmed whitespace" in a.lower() for a in cleaning["actions"])
    assert len(cleaning["diff"]) >= 4
    diff_map = {d["column"]: d for d in cleaning["diff"]}
    assert "Name" in diff_map
    assert diff_map["Name"]["whitespace_trimmed"] >= 1


def test_ai_analyst_natural_language_queries(client):
    report = upload_sample(client, "sales.csv")
    dataset_id = report["dataset_id"]

    queries = [
        ("Why did sales decline?", ["trend_analysis", "revenue"]),
        ("What is the largest category?", ["ranking", "category"]),
        ("Which region performs best?", ["ranking", "region"]),
        ("Show unusual values", ["anomaly_detection", "anomalies"]),
        ("What columns have missing data?", ["data_quality", "quality"]),
        ("What are the strongest correlations?", ["correlation"]),
        ("Forecast next month", ["forecasting", "forecast"]),
        ("Summarize this dataset", ["summary"]),
    ]

    for question, expected_keys in queries:
        res = client.post(f"/api/datasets/{dataset_id}/ask", json={"question": question})
        assert res.status_code == 200, f"Failed on question: {question}"
        ans = res.json()
        assert ans["answer"]
        assert len(ans["evidence"]) > 0
        assert ans["calculation"]


def test_dataset_export_csv_and_xlsx(client):
    report = upload_sample(client, "sales.csv")
    dataset_id = report["dataset_id"]

    # CSV download
    csv_res = client.get(f"/api/datasets/{dataset_id}/download")
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    assert len(csv_res.content) > 0

    # Excel download
    xlsx_res = client.get(f"/api/datasets/{dataset_id}/download.xlsx")
    assert xlsx_res.status_code == 200
    assert "spreadsheetml" in xlsx_res.headers["content-type"]
    assert len(xlsx_res.content) > 0


def test_invalid_and_corrupt_files_handled_gracefully(client):
    # Empty file
    empty_res = client.post("/api/datasets/upload", files={"file": ("empty.csv", b"", "text/csv")})
    assert empty_res.status_code == 400
    assert "empty" in empty_res.json()["detail"].lower()

    # Unsupported format
    unsupported_res = client.post("/api/datasets/upload", files={"file": ("data.pdf", b"%PDF", "application/pdf")})
    assert unsupported_res.status_code == 400
    assert "csv, xlsx or xls" in unsupported_res.json()["detail"].lower()

    # Corrupt Excel
    corrupt_res = client.post("/api/datasets/upload", files={"file": ("corrupt.xlsx", b"not-a-valid-zip", "application/vnd.openxmlformats")})
    assert corrupt_res.status_code == 400
