# Architecture

Browser → React/Vite → FastAPI → Analytics/ML services → Data layer.

The current release intentionally uses a CSV sample dataset so the project runs immediately without credentials. The API boundaries are designed so PostgreSQL, object storage and an enterprise LLM can be introduced without rewriting the frontend.
