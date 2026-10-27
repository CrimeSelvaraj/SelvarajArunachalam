# ProofPress API (`apps/api`)

FastAPI job orchestrator for scholarly news generation.

## Run locally

```bash
cd apps/api
uv sync
# optional: export OPENALEX_MAILTO=you@example.com
# optional: export GITHUB_TOKEN=ghp_…   # higher GitHub rate limits
uv run uvicorn scholarly_api.main:app --reload --port 8000
```

Health check: `GET http://localhost:8000/health`

## Discovery (Phases 3–4)

- `POST /jobs` — create a research job (topic + options; `include_github` defaults true)
- `GET /jobs` — list recent in-memory jobs
- `GET /jobs/{id}` — poll status, events, and discovered `sources`

The **search** stage calls:

- OpenAlex (`scholarly_api/openalex.py`) → `source_type=work`
- GitHub (`scholarly_api/github_client.py`) when `include_github` → `source_type=software`

Later stages remain stubbed.

Env: `OPENALEX_MAILTO` (recommended), `OPENALEX_API_KEY` (optional), `GITHUB_TOKEN` (optional, recommended for rate limits).
