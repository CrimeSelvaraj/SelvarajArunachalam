# ProofPress API (`apps/api`)

FastAPI job orchestrator for scholarly news generation.

## Run locally

```bash
cd apps/api
uv sync
# optional: export OPENALEX_MAILTO=you@example.com
# optional: export GITHUB_TOKEN=ghp_…   # higher GitHub rate limits
# optional: export OPENAI_API_KEY=…     # screening + PaperQA + compose; else heuristics
uv run uvicorn scholarly_api.main:app --reload --port 8000
```

Health check: `GET http://localhost:8000/health`

## Pipeline (Phases 3–9)

- `POST /jobs` — create a research job (topic + options; `include_github` defaults true; optional `screen_max`)
- `GET /jobs` — list recent in-memory jobs
- `GET /jobs/{id}` — poll status, events, `sources`, `screening`, `evidence`, `article`, and `bibliography`
- `GET /jobs/{id}/bibliography.bib` — BibTeX download (after cite stage)
- `GET /jobs/{id}/bibliography.json` — canonical CSL-JSON download
- `GET /jobs/{id}/export.md` — Markdown download (Phase 9)
- `GET /jobs/{id}/export.html` — standalone HTML via pandoc (Phase 9)
- `GET /jobs/{id}/export.docx` — DOCX via pandoc (Phase 9)

**Prerequisite:** system `pandoc` on `PATH` for HTML/DOCX (and preferred for Markdown). Install with `sudo apt-get install -y pandoc` — do not vendor the Haskell sources. PDF needs TeX/typst (deferred).

Stages:

1. **search** — OpenAlex (`openalex.py`) + optional GitHub (`github_client.py`)
2. **screen** — ASReview-inspired rank / dedupe / include-exclude (`screening.py`)
3. **read** — evidence pack (`evidence_pack.py`) + PaperQA adapter (`paperqa_adapter.py`)
4. **draft** — article composer (`composer.py`) — LLM or heuristic template
5. **cite** — citekeys + CSL-JSON + APA bibliography + BibTeX (`citations.py`)
6. **export** — on demand via `export.py` (pandoc CLI sidecar)

### Evidence pack

Per-job directory (default `apps/api/data/evidence/<job_id>/`):

- OA PDFs only when `is_oa` and a PDF URL are present (no paywall bypass)
- Abstract `.txt` files (full abstract re-fetched from OpenAlex when possible)
- Software README `.md` files

PaperQA is used as a **library** (`paper-qa` from PyPI). Without `OPENAI_API_KEY` (or compatible keys), the pack is still written and the job returns `evidence.status=paperqa_skipped` with heuristic excerpts.

### Article composer

`composer.py` builds news structure (lede / body / why it matters / limitations) with a claim→source map. Sensational unsupported claims are refused. Without an LLM key, a readable heuristic article is still produced from evidence quotes and findings and stored on `job.article` (`markdown` + `html`).

### Citations & bibliography

`citations.py` (cite stage) builds BBT-inspired citekeys, a canonical CSL-JSON array on `job.bibliography`, APA reference lines matching inline `[n]` markers, and a BibTeX file. Rendering is lean Python APA; pandoc `--citeproc` is probed when installed.

### Pandoc export (Phase 9)

`export.py` converts `job.article.markdown` (with Phase 8 References) to Markdown / HTML / DOCX via the system pandoc binary. HTML and DOCX try `--citeproc` with the job’s CSL-JSON (rewriting `[n]` → `[@citekey]`), then fall back to embedded APA References if citeproc fails. Response header `X-ProofPress-Export-Method` reports which path ran.

Env: see repo-root `.env.example` (`OPENAI_API_KEY`, `COMPOSE_LLM_MODEL`, `PAPERQA_*`, `EVIDENCE_PACK_ROOT`, OpenAlex/GitHub keys).
