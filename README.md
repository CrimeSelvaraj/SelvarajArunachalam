# ProofPress — AI Scholarly News Article Generator

Public web app where anyone enters a research topic and receives a **readable scholarly news article** grounded in open scholarship (OpenAlex, OA full text, public GitHub) — with transparent research progress and citation discipline.

> **Status:** Phases 0–5 — monorepo scaffold, public shell with header/side nav, job API, **OpenAlex + GitHub discovery**, and **ASReview-inspired screening**. PaperQA / compose / export remain stubbed.

## Monorepo layout

```
apps/web          Next.js (App Router) public site
apps/api          FastAPI job orchestrator + discovery + screening
packages/shared   Shared types / contracts (placeholder)
docs/             Product docs
```

## Prerequisites

| Tool | Notes |
|------|--------|
| **Node 22+** + **pnpm** | Frontend |
| **Python 3.12+** + **[uv](https://docs.astral.sh/uv/)** | Backend |
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
# optional OPENAI_API_KEY for LLM screening re-rank (else heuristics)

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
| `GET` | `/jobs/{id}` | Poll status, events, `sources`, and `screening` |

**Search stage (real):**

- **OpenAlex** — works map to `sources[]` with `source_type=work`.
- **GitHub** (when `options.include_github` is true, default) — repos map to `sources[]` with `source_type=software`.

**Screen stage (real, Phase 5):**

- Heuristic relevance score (title/abstract/README overlap + OA/cites/stars boosts)
- Optional light LLM re-rank when `OPENAI_API_KEY` is set; degrades to heuristics otherwise
- Deduplicate by DOI / normalized title / URL
- Cap included sources for deep read (default **12** quick / **18** deep; override with `options.screen_max`)
- Persist `screen_decision`, `relevance_score`, `screen_rationale` on each source + job `screening` summary

Later stages (**read → draft → cite**) are still stubbed delays.

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
| `OPENAI_API_KEY` | Optional | LLM screening re-rank (heuristic fallback) |
| `SCREENING_LLM_MODEL` | Optional | Default `gpt-4o-mini` |
| `API_ORIGIN` | For web | FastAPI origin for Next rewrites |

## License

See repository LICENSE; generated articles and disclosure wording are TBD.
