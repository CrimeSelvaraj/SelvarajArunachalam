from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, Response

from scholarly_api import __version__
from scholarly_api.export import ExportFormat, export_article, pandoc_available
from scholarly_api.models import (
    CreateJobRequest,
    HealthResponse,
    JobEvent,
    JobRecord,
    JobStage,
    JobStatus,
)
from scholarly_api.pipeline import run_pipeline
from scholarly_api.store import store

load_dotenv()

app = FastAPI(
    title="ProofPress API",
    description="Scholarly news article generator — job orchestrator",
    version=__version__,
)

cors_origins = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", service="proofpress-api", version=__version__)


@app.get("/jobs", response_model=list[JobRecord])
async def list_jobs(limit: int = Query(default=20, ge=1, le=100)) -> list[JobRecord]:
    return await store.list_recent(limit)


@app.post("/jobs", response_model=JobRecord, status_code=201)
async def create_job(body: CreateJobRequest) -> JobRecord:
    topic = body.topic.strip()
    if len(topic) < 3:
        raise HTTPException(status_code=422, detail="Topic must be at least 3 characters")

    job_id = str(uuid.uuid4())
    now = _now()
    job = JobRecord(
        id=job_id,
        topic=topic,
        options=body.options,
        status=JobStatus.pending,
        stage=JobStage.queued,
        progress=0.0,
        events=[
            JobEvent(
                stage=JobStage.queued,
                message=(
                    "Job queued — discovery, screening, evidence pack, then article compose."
                    if body.options.include_github
                    else "Job queued — OpenAlex discovery, screening, evidence, then compose."
                ),
                at=now,
                meta={
                    "providers": (
                        ["openalex", "github"]
                        if body.options.include_github
                        else ["openalex"]
                    ),
                    "screen_max": body.options.screen_max,
                },
            )
        ],
        created_at=now,
        updated_at=now,
    )
    await store.put(job)
    asyncio.create_task(run_pipeline(store, job_id))
    return job


@app.get("/jobs/{job_id}", response_model=JobRecord)
async def get_job(job_id: str) -> JobRecord:
    job = await store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.get("/jobs/{job_id}/bibliography.bib")
async def download_bibliography_bib(job_id: str) -> Response:
    """Download the job bibliography as BibTeX (Phase 8)."""
    job = await store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.bibliography is None or not job.bibliography.bibtex.strip():
        raise HTTPException(
            status_code=404,
            detail="Bibliography not ready yet (wait for the cite stage)",
        )
    filename = f"proofpress-{job_id[:8]}.bib"
    return Response(
        content=job.bibliography.bibtex,
        media_type="application/x-bibtex",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@app.get("/jobs/{job_id}/bibliography.json", response_class=PlainTextResponse)
async def download_bibliography_csl(job_id: str) -> Response:
    """Download canonical CSL-JSON for the job bibliography."""
    import json

    job = await store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.bibliography is None:
        raise HTTPException(
            status_code=404,
            detail="Bibliography not ready yet (wait for the cite stage)",
        )
    body = json.dumps(job.bibliography.csl_json, indent=2, ensure_ascii=False)
    filename = f"proofpress-{job_id[:8]}-csl.json"
    return Response(
        content=body,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


def _export_response(job: JobRecord, fmt: ExportFormat) -> Response:
    try:
        result = export_article(job, fmt)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        # Missing pandoc or conversion failure
        status = 503 if "not installed" in str(exc).lower() else 500
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    return Response(
        content=result.content,
        media_type=result.media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{result.filename}"',
            "X-ProofPress-Export-Method": result.method,
            "X-ProofPress-Pandoc": "1" if pandoc_available() else "0",
        },
    )


@app.get("/jobs/{job_id}/export.md")
async def export_markdown(job_id: str) -> Response:
    """Download the article as Markdown (Phase 9 — pandoc/GFM when available)."""
    job = await store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return _export_response(job, "md")


@app.get("/jobs/{job_id}/export.html")
async def export_html(job_id: str) -> Response:
    """Download the article as standalone HTML via pandoc (Phase 9)."""
    job = await store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return _export_response(job, "html")


@app.get("/jobs/{job_id}/export.docx")
async def export_docx(job_id: str) -> Response:
    """Download the article as DOCX via pandoc (Phase 9)."""
    job = await store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return _export_response(job, "docx")


def run() -> None:
    import uvicorn

    uvicorn.run(
        "scholarly_api.main:app",
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("API_PORT", "8000")),
        reload=os.getenv("API_RELOAD", "false").lower() == "true",
    )


if __name__ == "__main__":
    run()
