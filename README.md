# ProofPress — AI Scholarly News Article Generator

Public web app where anyone enters a research topic and receives a **readable scholarly news article** grounded in open scholarship (OpenAlex, OA full text, public GitHub) — with transparent research progress and citation discipline.

> **Status:** Phases 0–6 — monorepo scaffold, public shell with header/side nav, job API, **OpenAlex + GitHub discovery**, **ASReview-inspired screening**, and **evidence pack + PaperQA adapter**. Article compose / citations / export remain stubbed.

## Monorepo layout

```
apps/web          Next.js (App Router) public site
apps/api          FastAPI job orchestrator + discovery + screening + evidence
packages/shared   Shared types / contracts (placeholder)
docs/             Product docs
```

## Prerequisites

| Tool | Notes |
|------|--------|
| **Node 22+** + **pnpm** | Frontend |
| **Python 3.12+** + **[uv](https://docs.astral.sh/uv/)** | Backend (`paper-qa` included) |
| **pandoc** | Export sidecar (installed for later phases; unused yet) |

```bash
# pandoc (Debian/Ubuntu)
sudo apt-get update && sudo apt-get install -y pandoc

# uv
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## Run locally

```bash
cp .env.example .env
# set OPENALEX_MAILTO to a real contact email when possible
# optional GITHUB_TOKEN for higher GitHub search rate limits
# optional OPENAI_API_KEY for LLM screening + PaperQA (else heuristics / pack-only)

# API (terminal 1)
cd apps/api
uv sync
uv run uvicorn scholarly_api.main:app --reload --port 8000

# Web (terminal 2)
cd apps/web
pnpm install
pnpm dev
```

- Site: http://localhost:3000  
- API health: http://localhost:8000/health  
- Browser calls go through Next rewrites: `/api/backend/*` → FastAPI

## Job API

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/jobs` | Create job `{ topic, options? }` |
| `GET` | `/jobs` | Recent jobs (in-memory, newest first) |
| `GET` | `/jobs/{id}` | Poll status, events, `sources`, `screening`, `evidence` |

**Search stage (real):**

- **OpenAlex** — works map to `sources[]` with `source_type=work`.
- **GitHub** (when `options.include_github` is true, default) — repos map to `sources[]` with `source_type=software`.

**Screen stage (real, Phase 5):**

- Heuristic relevance score (title/abstract/README overlap + OA/cites/stars boosts)
- Optional light LLM re-rank when `OPENAI_API_KEY` is set; degrades to heuristics otherwise
- Deduplicate by DOI / normalized title / URL
- Cap included sources for deep read (default **12** quick / **18** deep; override with `options.screen_max`)
- Persist `screen_decision`, `relevance_score`, `screen_rationale` on each source + job `screening` summary

**Read stage (real, Phase 6):**

- Builds a per-job **evidence pack** under `apps/api/data/evidence/<job_id>/` (override with `EVIDENCE_PACK_ROOT`)
- Fetches **OA PDFs only** when OpenAlex already marked `is_oa` + `pdf_url` (never bypasses paywalls)
- Always writes abstracts (re-fetched from OpenAlex when possible) and GitHub README text for software
- Wraps **PaperQA** (`pip install paper-qa`) to index the pack and answer structured prompts: key findings, consensus, caveats
- Persists quote-level `evidence.quotes[]` with `source_id` plus `evidence.findings[]` on the job
- If `OPENAI_API_KEY` (or other PaperQA LLM keys) is missing: pack is still built; PaperQA is marked `paperqa_skipped` with heuristic excerpts

Later stages (**draft → cite**) are still stubbed delays.

### Options

```json
{
  "topic": "CRISPR genome editing tools",
  "options": {
    "depth": "quick",
    "include_github": true,
    "citation_style": "apa",
    "screen_max": 12
  }
}
```

## Environment variables

See [`.env.example`](.env.example).

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENALEX_MAILTO` | Recommended | Contact email in User-Agent / `mailto` query |
| `OPENALEX_API_KEY` | Optional | Higher OpenAlex budget |
| `GITHUB_TOKEN` | Optional | GitHub REST rate limits |
| `OPENAI_API_KEY` | Optional | LLM screening re-rank **and** PaperQA (heuristic / pack-only fallback) |
| `SCREENING_LLM_MODEL` | Optional | Default `gpt-4o-mini` |
| `PAPERQA_LLM` | Optional | Override PaperQA answer LLM |
| `PAPERQA_SUMMARY_LLM` | Optional | Override PaperQA summary LLM |
| `PAPERQA_EMBEDDING` | Optional | Override embedding model |
| `EVIDENCE_PACK_ROOT` | Optional | Directory for per-job evidence packs |
| `CROSSREF_API_KEY` | Optional | PaperQA metadata enrichment |
| `SEMANTIC_SCHOLAR_API_KEY` | Optional | PaperQA metadata enrichment |
| `API_ORIGIN` | For web | FastAPI origin for Next rewrites |

## License

See repository LICENSE; generated articles and disclosure wording are TBD.
