# ProofPress API (`apps/api`)

FastAPI job orchestrator for scholarly news generation.

## Run locally

```bash
cd apps/api
uv sync
# optional: export OPENALEX_MAILTO=you@example.com
# optional: export GITHUB_TOKEN=ghp_…   # higher GitHub rate limits
# optional: export OPENAI_API_KEY=…     # LLM screening; else heuristics
uv run uvicorn scholarly_api.main:app --reload --port 8000
```

Health check: `GET http://localhost:8000/health`

## Pipeline (Phases 3–5)

- `POST /jobs` — create a research job (topic + options; `include_github` defaults true; optional `screen_max`)
- `GET /jobs` — list recent in-memory jobs
- `GET /jobs/{id}` — poll status, events, discovered `sources`, and `screening` summary

Stages:

1. **search** — OpenAlex (`openalex.py`) + optional GitHub (`github_client.py`)
2. **screen** — ASReview-inspired rank / dedupe / include-exclude (`screening.py`); decisions persisted on each source
3. **read / draft / cite** — still stubbed

Env: `OPENALEX_MAILTO` (recommended), `OPENALEX_API_KEY` (optional), `GITHUB_TOKEN` (optional), `OPENAI_API_KEY` (optional for screening LLM).
