# Dataset API

Base URL for local development: `http://localhost:8000`. Uploads are multipart form data using field `file`; uploaded datasets return a `dataset_id` used by all subsequent calls. Maximum size is 50 MB. Accepted extensions are `.csv`, `.xlsx`, `.xls`.

## Upload Flow

1. `POST /api/datasets/preview` with multipart `file`; optional `sheet_name` selects an Excel sheet. Returns detected headers/types and up to 10 sample rows. Email and phone preview values are masked. Preview does not persist a session.
2. `POST /api/datasets/upload` with multipart `file`; optional `sheet_name`. Returns the session profile and ID, stores the original and clean copy in `data/uploads/<dataset_id>/`.
3. Use that ID on profile/analysis calls. Sessions can be removed with `DELETE /api/datasets/{dataset_id}`; `demo-sales` is protected.

## Session Routes

- `GET /api/datasets/{dataset_id}`: session summary and status.
- `GET /api/datasets/{dataset_id}/profile`: dataset classification, file details, schema, KPIs, charts, correlations, numeric statistics, cleaning report, quality, insights, alerts and forecast.
- `POST /api/datasets/{dataset_id}/clean`: cleaning actions and before/after quality summary. The uploaded source remains unchanged.
- `GET /api/datasets/{dataset_id}/kpis`
- `GET /api/datasets/{dataset_id}/visualizations`
- `GET /api/datasets/{dataset_id}/insights`
- `GET /api/datasets/{dataset_id}/anomalies`
- `GET /api/datasets/{dataset_id}/forecast`
- `POST /api/datasets/{dataset_id}/ask` with JSON `{"question":"Which region has the most records?"}`. Returns answer, evidence, source columns and calculation.
- `GET /api/datasets/{dataset_id}/report`: JSON analysis report.
- `GET /api/datasets/{dataset_id}/download`: cleaned CSV.
- `GET /api/dataset/export-clean.xlsx?dataset_id=...`: cleaned Excel workbook.
- `GET /api/dataset/rows?dataset_id=...&page=1&page_size=25&search=...&sort_by=...&sort_order=asc`: paginated row explorer. Sensitive cells are masked and excluded from search.

## Resource Routes

The UI uses these resource-style equivalents:

- `GET /api/dataset/profile?dataset_id=...`
- `GET /api/dataset/schema?dataset_id=...`
- `GET /api/dataset/quality?dataset_id=...`
- `GET /api/dataset/kpis?dataset_id=...`
- `GET /api/dataset/charts?dataset_id=...`
- `GET /api/dataset/insights?dataset_id=...`
- `GET /api/dataset/forecast?dataset_id=...`
- `GET /api/dataset/alerts?dataset_id=...`
- `POST /api/analyst/ask` with JSON `{"dataset_id":"...","question":"..."}`

`GET /api/health` is independent of dataset selection. Legacy demo routes remain available and accept an optional `dataset_id` query parameter.

## Response Guarantees

Analyst responses include the original question, answer, evidence, `source_columns`, and `calculation`. Forecast responses include `available`, `reason` when unavailable, selected metric, source columns, history and projected values. Derived e-commerce revenue is explicitly represented as `price × quantity`; it is not inserted into the preserved clean/raw dataset.
