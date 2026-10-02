# InsightOps AI — API Reference Manual

Base URL for local development: `http://localhost:8000`.  
Interactive OpenAPI / Swagger documentation is available at `http://localhost:8000/docs`.

---

## 1. Authentication & User Endpoints

| Endpoint | Method | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `/api/auth/signup` | `POST` | No | Registers user, hashes password via PBKDF2, generates JWT tokens and initial workspace |
| `/api/auth/login` | `POST` | No | Verifies credentials and issues HS256 access and refresh tokens |
| `/api/auth/refresh` | `POST` | No | Exchanges refresh token for new access token |
| `/api/auth/me` | `GET` | Yes (Bearer) | Returns active user profile, organizations, and workspaces |
| `/api/auth/profile` | `PUT` | Yes (Bearer) | Updates full name, avatar URL, theme preference, and number notation |
| `/api/auth/password` | `PUT` | Yes (Bearer) | Changes user password after validating current password |
| `/api/auth/forgot-password` | `POST` | No | Requests secure password reset verification token |
| `/api/auth/reset-password` | `POST` | No | Resets password using verification token |
| `/api/auth/logout` | `POST` | Yes (Bearer) | Logs logout event in audit trail and invalidates session |

---

## 2. Workspaces & RBAC Endpoints

| Endpoint | Method | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `/api/workspaces` | `GET` | Yes (Bearer) | Lists all workspaces the user has access to |
| `/api/workspaces` | `POST` | Yes (Bearer) | Creates a new workspace and designates caller as Owner |
| `/api/workspaces/{id}` | `GET` | Yes (Bearer) | Fetches workspace details and metadata |
| `/api/workspaces/{id}` | `PUT` | Yes (Bearer) | Updates workspace name and description (Admin/Owner) |
| `/api/workspaces/{id}` | `DELETE` | Yes (Bearer) | Deletes workspace and associated resources (Owner) |
| `/api/workspaces/{id}/members` | `GET` | Yes (Bearer) | Lists members and their roles |
| `/api/workspaces/{id}/members` | `POST` | Yes (Bearer) | Invites / adds user by email with role (Admin/Owner) |
| `/api/workspaces/{id}/members/{user_id}` | `PUT` | Yes (Bearer) | Changes member role (Owner, Admin, Analyst, Viewer) |
| `/api/workspaces/{id}/members/{user_id}` | `DELETE` | Yes (Bearer) | Removes member from workspace |

---

## 3. Reports Manager Endpoints

| Endpoint | Method | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `/api/reports` | `GET` | Optional | Lists saved reports in active workspace |
| `/api/reports` | `POST` | Yes (Bearer) | Creates multi-page report with visuals and schedule settings |
| `/api/reports/{id}` | `GET` | Optional | Retrieves report definition (supports public shared reports) |
| `/api/reports/{id}` | `PUT` | Yes (Bearer) | Updates report title, pages layout, and schedule |
| `/api/reports/{id}` | `DELETE` | Yes (Bearer) | Deletes saved report |
| `/api/reports/{id}/duplicate` | `POST` | Yes (Bearer) | Clones a report and all its pages |
| `/api/reports/{id}/share` | `POST` | Yes (Bearer) | Toggles public sharing link and permission level |

---

## 4. Alerts Center Endpoints

| Endpoint | Method | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `/api/alerts` | `GET` | Optional | Lists configured alert monitoring rules |
| `/api/alerts` | `POST` | Yes (Bearer) | Creates threshold, anomaly, or KPI alert rule |
| `/api/alerts/{id}/toggle` | `POST` | Yes (Bearer) | Toggles alert rule active / paused state |
| `/api/alerts/{id}` | `DELETE` | Yes (Bearer) | Deletes an alert monitoring rule |
| `/api/alerts/notifications` | `GET` | Optional | Dynamically evaluates active dataset against all active rules and returns triggered notifications feed |

---

## 5. Activity Audit Trail & System Endpoints

| Endpoint | Method | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `/api/activity` | `GET` | Optional | Retrieves chronological audit events with filtering by action |
| `/api/search` | `GET` | Optional | Universal spotlight search across reports, datasets, workspaces, and alerts |
| `/api/system/health` | `GET` | No | Real-time database telemetry, engine dialect, ORM table row counts, uptime, and version |

---

## 6. Power BI Visualization Query Engine

- **Endpoint**: `POST /api/dataset/visualize/query` (or `/api/datasets/{id}/visualize/query`)
- **Request Body**:
  ```json
  {
    "visual_type": "column",
    "x_field": "category",
    "y_field": "revenue",
    "aggregation": "sum",
    "secondary_dimension": "region",
    "date_granularity": "month",
    "filters": {"region": ["North", "South"]},
    "top_n": 10
  }
  ```
- **Response**: Aggregated data points, series keys, formatting metadata, and sparklines.

---

## 7. Universal Dataset & Analytics Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `POST /api/datasets/preview` | `POST` | Dry run inspection with delimiter, encoding, and sheet sniffer |
| `POST /api/datasets/upload` | `POST` | Ingests dataset, executes cleaning pipeline, builds profile |
| `GET /api/dataset/profile` | `GET` | Comprehensive statistical summary and health score |
| `GET /api/dataset/schema` | `GET` | Semantic column types and PII indicators |
| `GET /api/dataset/quality` | `GET` | Quality breakdown (completeness, validity, uniqueness) |
| `GET /api/dataset/kpis` | `GET` | Dynamically calculated domain KPIs with formulas |
| `GET /api/dataset/insights` | `GET` | Evidence-backed natural language findings |
| `GET /api/dataset/anomalies` | `GET` | Multi-model statistical outlier list |
| `GET /api/dataset/forecast` | `GET` | Double exponential smoothing time-series forecast |
| `POST /api/dataset/ask` | `POST` | Deterministic AI Analyst query engine |
| `GET /api/dataset/table` | `GET` | Paginated, searchable, sorted data table with PII masking |
| `GET /api/dataset/export-clean` | `GET` | Download cleaned CSV |
| `GET /api/dataset/export-clean.xlsx` | `GET` | Download cleaned Excel workbook |
