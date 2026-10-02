# InsightOps AI

Universal Dataset Intelligence Platform

InsightOps AI profiles CSV and Excel datasets, detects schema and semantics, cleans a separate working copy, reports data quality, and builds dataset-aware KPIs, charts, alerts, forecasts and deterministic analyst answers. The original upload is preserved unchanged.

## Features

- CSV, XLSX and XLS uploads up to 50 MB
- Dataset sessions with IDs and disk-backed raw/clean copies under `data/uploads/`
- Semantic schema detection, type conversion, missing/duplicate/invalid/outlier checks and PII masking
- Dataset-specific KPIs, category/time-series charts, histograms, scatter plots, correlations, insights and date-based forecasts
- AI Analyst answers with evidence, source columns and calculation descriptions; no external AI provider
- Data Studio sections for overview, schema, quality, missing values, duplicates, data types, sensitive fields, cleaning actions and a paginated/searchable data table
- CSV/XLSX clean export, JSON profile/report and path-based API routes
- Animated Three.js lamp login screen with responsive local-preview access
- Bundled sales and customer-operations sample datasets

## Run Locally

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ..
uvicorn backend.app.main:app --reload --port 8000
```

For backend tests and XLS test-file generation, install the development requirements:

```bash
cd backend
source .venv/bin/activate
pip install -r requirements-dev.txt
cd ..
python -m pytest tests -q
```

### Frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

The sign-in screen is a local demo gate, not production authentication: enter a valid email and any password with at least 8 characters to open the workspace. Credentials are validated in the browser and are not sent to the API.

### Docker

```bash
docker compose up --build
```

## Sample Data

- `data/sample/sales.csv` exercises financial analytics.
- `data/sample/customer_operations.csv` exercises universal CRM/lead analysis, PII detection, invalid values and quality alerts.
- `data/sample/hr.csv` exercises employee, salary, department and attrition metrics.
- `data/sample/ecommerce.csv` exercises orders, customers, product/category/country analysis and revenue derived from `price × quantity`.
- `data/sample/finance.csv` exercises income, expenses and cash-flow metrics.
- `data/sample/healthcare.csv` exercises patients, treatment/outcome analysis and recovery rate.

Uploaded datasets are local session data, not source fixtures. Each upload returns a `dataset_id`; frontend requests use that ID to isolate profiles and analytics. `demo-sales` selects the bundled sales dataset. Uploaded raw files and cleaned copies are retained under `data/uploads/<dataset_id>/` and are excluded from Git.

## Dataset API

The complete route contract and request examples are in [docs/api.md](docs/api.md). Upload a multipart field named `file`; call `/api/datasets/preview` first for a masked sample, then `/api/datasets/upload` to persist the chosen file/sheet.

- `POST /api/datasets/preview`
- `POST /api/datasets/upload`
- `GET /api/dataset/rows?dataset_id=...&page=1&page_size=25`
- `DELETE /api/datasets/{dataset_id}`
- `GET /api/datasets/{dataset_id}/report`
- `GET /api/dataset/export-clean.xlsx?dataset_id=...`
- `POST /api/dataset/upload`
- `GET /api/dataset/profile?dataset_id=...`
- `GET /api/dataset/schema?dataset_id=...`
- `GET /api/dataset/quality?dataset_id=...`
- `GET /api/dataset/kpis?dataset_id=...`
- `GET /api/dataset/insights?dataset_id=...`
- `GET /api/dataset/charts?dataset_id=...`
- `GET /api/dataset/forecast?dataset_id=...`
- `GET /api/dataset/alerts?dataset_id=...`
- `GET /api/dataset/export-clean?dataset_id=...`
- `POST /api/analyst/ask` with `{"dataset_id":"...","question":"..."}`
- `GET /api/health`

Path-based routes are also available at `/api/datasets/{id}/profile`, `/clean`, `/kpis`, `/visualizations`, `/insights`, `/anomalies`, `/forecast`, `/ask`, `/report` and `/download`. Each route operates only on the supplied session ID.

Legacy demo routes (`/api/overview`, `/api/trends`, `/api/categories`, `/api/regions`, `/api/anomalies`, `/api/forecast`, and `/api/ask`) remain available and accept an optional `dataset_id` query parameter.

## Data Handling

The upload size limit is 50 MB. File extensions are restricted to CSV, XLSX and XLS; filenames are sanitized. Column headers and surrounding whitespace are normalized in the cleaned copy, and detected dates/numbers are converted. Missing values, duplicates and invalid values are reported rather than silently removed. PII values are masked in schema samples and excluded from charts and analyst answers. The cleaned export is available only through an explicit download action.
