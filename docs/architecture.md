# InsightOps AI — Architecture & Technical Design

## 1. System Philosophy

InsightOps AI operates on four fundamental engineering invariants:
1. **Dynamic Schema-Agnostic Intelligence**: The platform never relies on static column names or pre-baked dashboards. All schemas, semantic roles, data types, KPIs, chart selections, and analytical queries are derived at runtime from the uploaded dataset.
2. **Deterministic, Traceable Computations**: No hallucinations. Every single KPI, anomaly, chart, and AI Analyst answer is grounded in verifiable mathematical operations with source column lineage and explicit formulas.
3. **Enterprise SaaS Security & Multi-Tenancy**: Built on RFC 7519 HS256 JWT authentication, NIST PBKDF2 password hashing, and granular Role-Based Access Control (RBAC) across isolated team workspaces.
4. **Resilient Local & Production Operation**: Works out-of-the-box locally with SQLite and disk-backed sessions, while seamlessly scaling to PostgreSQL and containerized cloud environments with Docker Compose.

---

## 2. Architecture Diagram

```mermaid
flowchart TD
    subgraph Client["Presentation Tier (React 19 + Vite + Lucide + Recharts)"]
        AuthProvider["AuthProvider & JWT Token Handler"]
        TopNav["SaaS Topbar (Workspace Switcher | Global Search ⌘K | Theme Toggle | Profile)"]
        
        subgraph SaaSViews["Operational SaaS Views"]
            V_Dash["SaaS Dashboard Overview"]
            V_Studio["Power BI Visual Studio (18 Visuals & Slicers)"]
            V_Data["Universal Data Ingestion Studio"]
            V_Reports["Reports Manager & Scheduler"]
            V_Analyst["Deterministic AI Analyst"]
            V_EDA["Exploratory Data Analysis Workspace"]
            V_Alerts["Alerts Center (Rules & Dynamic Feed)"]
            V_WS["Workspaces & RBAC Management"]
            V_Audit["Activity Audit Trail"]
            V_Settings["User Profile & System Health"]
        end
    end

    subgraph API["Application Tier (FastAPI Python 3.12)"]
        R_Auth["/api/auth (SignUp, Login, Refresh, Me, Reset)"]
        R_WS["/api/workspaces (CRUD, Members, Roles)"]
        R_Reports["/api/reports (Multi-Page, Share, Schedule)"]
        R_Alerts["/api/alerts (Rules & Live Evaluator)"]
        R_Activity["/api/activity (Immutable Audit Trail)"]
        R_Search["/api/search (Universal Spotlight Search)"]
        R_System["/api/system/health (Telemetry & Diagnostics)"]
        R_Dataset["/api/dataset/* (Ingestion, Clean, Schema, Profile, Export)"]
        R_Viz["/api/visualize/query (Power BI Aggregations & Slicers)"]
        R_Analyst["/api/analyst/query (Deterministic AI Engine)"]
    end

    subgraph Core["Analytical & Business Intelligence Core"]
        S_Ingest["IngestionService (Encoding, Delimiter, Sheet Sniffer)"]
        S_Clean["CleaningEngine (Non-Destructive Normalization & Diff)"]
        S_Profile["ProfilingEngine (Statistical Profiler & Health Scorer)"]
        S_KPI["DynamicKPIEngine (Sales, HR, E-com, Finance, Health)"]
        S_Viz["VisualQueryService (Dynamic Aggregations, Cross-Filtering)"]
        S_Anomaly["AnomalyEngine (IQR, Z-Score, Isolation Forest)"]
        S_Forecast["ForecastEngine (Double Exponential Smoothing)"]
        S_Security["Security & Token Service (PBKDF2 & HS256 JWT)"]
    end

    subgraph Persistence["Database & Persistence Tier"]
        ORM["SQLAlchemy 2.0 ORM"]
        Postgres[("PostgreSQL 16 (Production)")]
        SQLite[("SQLite Fallback (Local Dev / Tests)")]
        Store["DatasetStore (Raw & Cleaned CSV/Excel on Disk)"]
    end

    Client --> API
    API --> Core
    Core --> Persistence
```

---

## 3. Database Schema Design (SQLAlchemy ORM)

| Table | Primary Key | Key Attributes | Purpose |
| :--- | :--- | :--- | :--- |
| `users` | `id` (UUID) | `email`, `hashed_password`, `full_name`, `avatar_url`, `is_active`, `theme_preference` | User credentials and profile settings |
| `organizations` | `id` (UUID) | `name`, `slug`, `owner_id` | Enterprise multi-tenancy parent boundary |
| `workspaces` | `id` (String/UUID) | `organization_id`, `owner_id`, `name`, `description` | Isolated analytical environment |
| `workspace_members` | `id` (UUID) | `workspace_id`, `user_id`, `role` (`Owner`, `Admin`, `Analyst`, `Viewer`) | Role-based access control binding |
| `datasets` | `id` (String) | `workspace_id`, `name`, `filename`, `row_count`, `quality_score`, `storage_path` | Ingested universal datasets |
| `reports` | `id` (UUID) | `workspace_id`, `title`, `description`, `pages` (JSON), `is_shared`, `schedule_frequency` | Multi-page reports with visuals and scheduling |
| `dashboards` | `id` (UUID) | `workspace_id`, `report_id`, `name`, `layout` (JSON) | Live dashboard layouts |
| `visual_items` | `id` (UUID) | `dashboard_id`, `title`, `visual_type`, `config` (JSON) | Individual Power BI visual definitions |
| `alert_rules` | `id` (UUID) | `workspace_id`, `name`, `metric`, `condition_operator`, `threshold_value`, `severity`, `is_active` | Real-time threshold monitoring rules |
| `activity_logs` | `id` (UUID) | `workspace_id`, `user_id`, `user_email`, `action`, `resource`, `ip_address`, `details` (JSON) | Immutable security audit trail |

---

## 4. Power BI Visual Engine Architecture

The visual engine processes aggregated queries dynamically via `/api/visualize/query`:
- **Dimensions & X-Axis**: Grouping by categorical fields or date hierarchy (`Year`, `Quarter`, `Month`, `Day`).
- **Measures & Y-Axis**: Aggregated via `sum`, `avg`, `count`, `distinct_count`, `min`, `max`, `median`, or `pct`.
- **Secondary Dimensions / Legend**: Produces stacked bar or multi-series clustered aggregations.
- **Cross-Filtering**: Filters are applied dynamically to the DataFrame, re-aggregating remaining fields and generating dimmed visual cues for unselected slices.
- **Auto Recommender**: Selects the optimal chart type (Column, Bar, Line, Area, Pie, Donut, Scatter, Box Plot, Heatmap, Funnel, Gauge, KPI Card) based on field cardinality and semantic types.
