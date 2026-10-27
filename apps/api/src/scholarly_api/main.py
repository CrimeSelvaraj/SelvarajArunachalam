from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from scholarly_api import __version__
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
                    "Job queued — discovery then ASReview-inspired screening."
                    if body.options.include_github
                    else "Job queued — OpenAlex discovery then screening."
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
