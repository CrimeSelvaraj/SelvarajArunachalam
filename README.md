# ProofPress — AI Scholarly News Article Generator

Public web app where anyone enters a research topic and receives a **readable scholarly news article** grounded in open scholarship (OpenAlex, OA full text, public GitHub) — with transparent research progress and citation discipline.

> **Status:** Phases 0–2 shipped — monorepo scaffold, public landing shell, and stub job API with fake pipeline stages. Real discovery / PaperQA / export land in later phases (see project build plan).

## Monorepo layout

```
apps/web          Next.js (App Router) public site
apps/api          FastAPI job orchestrator
packages/shared   Shared types / contracts (placeholder)
docs/             Product docs
```

## Prerequisites

| Tool | Notes |
|------|--------|
| **Node 22+** + **pnpm** | Frontend |
| **Python 3.12+** + **[uv](https://docs.astral.sh/uv/)** | Backend |
| **pandoc** | Export sidecar (installed for later phases; unused by stubs) |

Install tooling if missing:

```bash
# pandoc (Debian/Ubuntu)
sudo apt-get update && sudo apt-get install -y pandoc

# uv
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## Run locally

```bash
cp .env.example .env

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

## Job API stub (Phase 2)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/jobs` | Create job `{ topic, options? }` |
| `GET` | `/jobs/{id}` | Poll status + stage events |

Simulated stages: **search → screen → read → draft → cite → complete**. No OpenAlex / GitHub / LLM calls yet.

## Environment variables

See [`.env.example`](.env.example). LLM / OpenAlex / GitHub keys are listed for later phases and are **not** required for the stub.

## License

See repository LICENSE when added; generated articles and disclosure wording are TBD.
