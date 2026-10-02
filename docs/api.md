# InsightOps AI — API Reference Manual

Base URL for local development: `http://localhost:8000`.  
Interactive OpenAPI / Swagger documentation is available at `http://localhost:8000/docs`.

---

## Ingestion & Upload Endpoints

### 1. Ingestion Preview (Dry Run)
- **Endpoint**: `POST /api/datasets/preview`
- **Content-Type**: `multipart/form-data`
- **Parameters**:
  - `file`: CSV, XLSX, or XLS file binary (up to 50 MB)
  - `sheet_name` *(optional)*: Target sheet name for Excel workbooks
- **Response**:
  ```json
  {
    "filename": "sales.csv",
    "file_size": 24192,
    "extension": "csv",
    "sheets": [],
    "detected_delimiter": ",",
    "detected_encoding": "utf-8",
    "row_count_estimate": 100,
    "columns": [
      {"name": "revenue", "inferred_type": "numeric"},
      {"name": "region", "inferred_type": "categorical"}
    ],
    "sample_rows": [
      {"revenue": 1200.5, "region": "North"}
    ]
  }
  ```

### 2. Dataset Upload & Ingestion
- **Endpoint**: `POST /api/datasets/upload` (or `POST /api/dataset/upload`)
- **Content-Type**: `multipart/form-data`
- **Parameters**:
  - `file`: CSV, XLSX, or XLS file binary
  - `sheet_name` *(optional)*: Sheet selection for Excel workbooks
- **Response**: Full Dataset Profile object containing `dataset_id`, `dataset_type`, `quality_score`, `kpis`, `charts`, `insights`, `anomalies`, `forecast`, and `cleaning_report`.

---

## Analytics & Profile Endpoints

All analytics endpoints support both path-based routing (`/api/datasets/{dataset_id}/...`) and query-parameter routing (`/api/dataset/...`):

| Path Route | Query Parameter Route | Method | Description |
| :--- | :--- | :--- | :--- |
| `/api/datasets/{id}` | `/api/dataset?dataset_id={id}` | `GET` | Summary metadata for active dataset session |
| `/api/datasets/{id}/profile` | `/api/dataset/profile?dataset_id={id}` | `GET` | Full statistical profile, health scores, and metrics |
| `/api/datasets/{id}/schema` | `/api/dataset/schema?dataset_id={id}` | `GET` | Detected column types, uniqueness, and PII flags |
| `/api/datasets/{id}/quality` | `/api/dataset/quality?dataset_id={id}` | `GET` | Overall score and component sub-scores (0–100) |
| `/api/datasets/{id}/kpis` | `/api/dataset/kpis?dataset_id={id}` | `GET` | Domain-tailored KPIs with mathematical formulas |
| `/api/datasets/{id}/visualizations` | `/api/dataset/charts?dataset_id={id}` | `GET` | Auto-generated chart recommendations & series data |
| `/api/datasets/{id}/insights` | `/api/dataset/insights?dataset_id={id}` | `GET` | Verifiable natural language findings & calculations |
| `/api/datasets/{id}/anomalies` | `/api/dataset/anomalies?dataset_id={id}` | `GET` | Multi-method outlier list with severity scores |
| `/api/datasets/{id}/forecast` | `/api/dataset/forecast?dataset_id={id}` | `GET` | Double Exponential Smoothing forecast with 95% CIs |
| `/api/datasets/{id}/alerts` | `/api/dataset/alerts?dataset_id={id}` | `GET` | Operational warnings & threshold alerts |
| `/api/datasets/{id}/report` | `/api/dataset/report?dataset_id={id}` | `GET` | Complete audit and analytical JSON report |
| `/api/datasets/{id}` | `/api/datasets/{id}` | `DELETE` | Removes session from disk (except demo fixtures) |

---

## AI Analyst Query Endpoint

- **Endpoint**: `POST /api/datasets/{dataset_id}/ask` (or `POST /api/analyst/ask`)
- **Content-Type**: `application/json`
- **Request Body**:
  ```json
  {
    "dataset_id": "session-12345",
    "question": "What is the average salary by department?"
  }
  ```
- **Response**:
  ```json
  {
    "question": "What is the average salary by department?",
    "answer": "Department Engineering has the highest average salary at ₹12.4L across 4 employees.",
    "evidence": [
      {"label": "Top Department", "value": "Engineering"},
      {"label": "Average Salary", "value": "124,000"}
    ],
    "source_columns": ["department", "salary"],
    "calculation": "GROUP_BY(department) -> AVG(salary)"
  }
  ```

---

## Data Grid Explorer & Export Endpoints

### 1. Paginated Rows Explorer
- **Endpoint**: `GET /api/dataset/rows` or `GET /api/datasets/{dataset_id}/rows`
- **Query Parameters**:
  - `dataset_id`: Session ID
  - `page`: Page index (default: `1`)
  - `page_size`: Rows per page (default: `25`, max: `100`)
  - `search`: Substring search query across all non-sensitive columns
  - `sort_by`: Column name to sort on
  - `sort_order`: `asc` or `desc`

### 2. Export Cleaned Dataset
- **Cleaned CSV**: `GET /api/datasets/{dataset_id}/download` (or `/api/dataset/export-clean?dataset_id={id}`)
- **Cleaned Excel (.xlsx)**: `GET /api/datasets/{dataset_id}/download.xlsx` (or `/api/dataset/export-clean.xlsx?dataset_id={id}`)
