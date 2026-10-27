# ProofPress API (`apps/api`)

FastAPI job orchestrator for scholarly news generation.

## Run locally

```bash
cd apps/api
uv sync
# optional: export OPENALEX_MAILTO=you@example.com
uv run uvicorn scholarly_api.main:app --reload --port 8000
```

Health check: `GET http://localhost:8000/health`

## Phase 3 — OpenAlex discovery

- `POST /jobs` — create a research job (topic + options)
- `GET /jobs` — list recent in-memory jobs
- `GET /jobs/{id}` — poll status, events, and discovered `sources`

The **search** stage calls OpenAlex (`scholarly_api/openalex.py`). Later stages remain stubbed.

Env: `OPENALEX_MAILTO` (recommended), `OPENALEX_API_KEY` (optional).
