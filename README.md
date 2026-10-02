# InsightOps AI

> AI-Powered Business Intelligence & Decision Platform

InsightOps AI is a portfolio-grade analytics product that turns operational business data into an executive decision surface. It combines automated KPI analysis, anomaly detection, forecasting, regional/category intelligence and an AI analyst interface.

## Highlights

- Executive dashboard with responsive glassmorphism UI
- Animated gradients, hover frames and micro-interactions
- FastAPI analytics backend
- Pandas-powered aggregation
- Isolation Forest anomaly detection
- Linear-regression revenue forecasting
- Natural-language analyst endpoint
- CSV profiling endpoint
- PostgreSQL-ready architecture
- Docker Compose setup
- API tests
- Sample business dataset
- Mobile-responsive layout

## Run locally

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ..
uvicorn backend.app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

### Docker
```bash
docker compose up --build
```

## API

- `GET /api/health`
- `GET /api/overview`
- `GET /api/trends`
- `GET /api/categories`
- `GET /api/regions`
- `GET /api/anomalies`
- `GET /api/forecast`
- `GET /api/ask?q=...`
- `POST /api/profile`

## Production roadmap

1. Add PostgreSQL + Alembic migrations.
2. Add authentication/RBAC and tenant isolation.
3. Replace demo analyst logic with a governed LLM + SQL execution layer.
4. Add background jobs with Celery/Redis.
5. Add model registry, feature store and experiment tracking.
6. Deploy frontend and API independently with CI/CD.
7. Add audit logs and data lineage.

## Portfolio positioning

This project demonstrates the full analytics lifecycle: ingestion → quality profiling → KPI computation → diagnostic analysis → ML signals → forecasting → decision support → product delivery.
