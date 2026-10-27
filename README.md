# ProofPress — AI Scholarly News Article Generator

Public web app where anyone enters a research topic and receives a **readable scholarly news article** grounded in open scholarship (OpenAlex, OA full text, public GitHub) — with transparent research progress and citation discipline.

> **Status:** Phases 0–4 — monorepo scaffold, public shell with header/side nav, job API, **OpenAlex + GitHub discovery**. Screening / PaperQA / compose / export remain stubbed.

## Monorepo layout

```
apps/web          Next.js (App Router) public site
apps/api          FastAPI job orchestrator + discovery clients
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
| `GET` | `/jobs/{id}` | Poll status, events, and `sources` |

**Search stage (real):**

- **OpenAlex** — `GET https://api.openalex.org/works?search=…&mailto=…` with a polite `User-Agent`. Works map to `sources[]` with `source_type=work`.
- **GitHub** (when `options.include_github` is true, default) — repository search plus README and `CITATION.cff` when present. Repos map to `sources[]` with `source_type=software` (stars, license, truncated README/CFF).

Later stages (**screen → read → draft → cite**) are still stubbed delays.

### OpenAlex call shape

```http
GET https://api.openalex.org/works?search=<topic>&per_page=8&select=id,doi,title,...&mailto=<OPENALEX_MAILTO>
User-Agent: ProofPress/0.2 (+https://github.com/CrimeSelvaraj/SelvarajArunachalam) (mailto:<OPENALEX_MAILTO>)
Accept: application/json
```

Optional: `api_key=<OPENALEX_API_KEY>` for a dedicated daily budget.

### GitHub call shape

```http
GET https://api.github.com/search/repositories?q=<topic>+in:name,description,readme&sort=stars&order=desc&per_page=5
Authorization: Bearer <GITHUB_TOKEN>   # optional but recommended
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
User-Agent: ProofPress/0.3 (+https://github.com/CrimeSelvaraj/SelvarajArunachalam)
```

Per repo (when enriching candidates): `GET /repos/{owner}/{repo}/readme` and `GET /repos/{owner}/{repo}/contents/CITATION.cff`.

## Environment variables

See [`.env.example`](.env.example).

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENALEX_MAILTO` | Recommended | Contact email in User-Agent / `mailto` query (OpenAlex polite use) |
| `OPENALEX_API_KEY` | Optional | Higher OpenAlex budget |
| `GITHUB_TOKEN` | Optional | GitHub REST search/API rate limits (60/hr unauthenticated vs 5000/hr with token) |
| `API_ORIGIN` | For web | FastAPI origin for Next rewrites |
| LLM / Crossref keys | Later phases | Not used yet |

## License

See repository LICENSE; generated articles and disclosure wording are TBD.
