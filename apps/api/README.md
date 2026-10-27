# ProofPress API (`apps/api`)

FastAPI job orchestrator for scholarly news generation.

## Run locally

```bash
cd apps/api
uv sync
uv run uvicorn scholarly_api.main:app --reload --port 8000
```

Health check: `GET http://localhost:8000/health`

## Phase 2 stub

- `POST /jobs` — create a research job (topic + options)
- `GET /jobs/{id}` — poll status and staged progress events

Stages are **simulated** (`search` → `screen` → `read` → `draft` → `cite`). Real OpenAlex / GitHub / PaperQA wiring starts in later phases.
