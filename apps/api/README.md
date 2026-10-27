# ProofPress API (`apps/api`)

FastAPI job orchestrator for scholarly news generation.

## Run locally

```bash
cd apps/api
uv sync
# optional: export OPENALEX_MAILTO=you@example.com
# optional: export GITHUB_TOKEN=ghp_…   # higher GitHub rate limits
# optional: export OPENAI_API_KEY=…     # screening LLM + PaperQA; else heuristics / pack-only
uv run uvicorn scholarly_api.main:app --reload --port 8000
```

Health check: `GET http://localhost:8000/health`

## Pipeline (Phases 3–6)

- `POST /jobs` — create a research job (topic + options; `include_github` defaults true; optional `screen_max`)
- `GET /jobs` — list recent in-memory jobs
- `GET /jobs/{id}` — poll status, events, `sources`, `screening`, and `evidence`

Stages:

1. **search** — OpenAlex (`openalex.py`) + optional GitHub (`github_client.py`)
2. **screen** — ASReview-inspired rank / dedupe / include-exclude (`screening.py`)
3. **read** — evidence pack (`evidence_pack.py`) + PaperQA adapter (`paperqa_adapter.py`)
4. **draft / cite** — still stubbed

### Evidence pack

Per-job directory (default `apps/api/data/evidence/<job_id>/`):

- OA PDFs only when `is_oa` and a PDF URL are present (no paywall bypass)
- Abstract `.txt` files (full abstract re-fetched from OpenAlex when possible)
- Software README `.md` files

PaperQA is used as a **library** (`paper-qa` from PyPI). Without `OPENAI_API_KEY` (or compatible keys), the pack is still written and the job returns `evidence.status=paperqa_skipped` with heuristic excerpts.

Env: see repo-root `.env.example` (`OPENAI_API_KEY`, `PAPERQA_*`, `EVIDENCE_PACK_ROOT`, OpenAlex/GitHub keys).
