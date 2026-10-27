from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from scholarly_api.models import JobEvent, JobRecord, JobStage, JobStatus
from scholarly_api.store import JobStore

# Fake pipeline timeline for UI progress streaming (no real research yet).
STAGES: list[tuple[JobStage, str, float, float]] = [
    (JobStage.search, "Searching OpenAlex and open web for candidate works…", 0.15, 1.2),
    (JobStage.screen, "Screening and ranking sources by relevance…", 0.35, 1.0),
    (JobStage.read, "Reading open-access abstracts and evidence snippets…", 0.55, 1.4),
    (JobStage.draft, "Drafting a scholarly news narrative…", 0.78, 1.2),
    (JobStage.cite, "Attaching citations and bibliography stubs…", 0.92, 0.9),
]


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def run_stub_pipeline(store: JobStore, job_id: str) -> None:
    job = await store.get(job_id)
    if job is None:
        return

    job.status = JobStatus.running
    job.updated_at = _now()
    await store.update(job)

    try:
        for stage, message, progress, delay in STAGES:
            await asyncio.sleep(delay)
            job = await store.get(job_id)
            if job is None:
                return
            job.stage = stage
            job.progress = progress
            job.events.append(
                JobEvent(stage=stage, message=message, at=_now(), meta={"stub": True})
            )
            job.updated_at = _now()
            await store.update(job)

        await asyncio.sleep(0.6)
        job = await store.get(job_id)
        if job is None:
            return
        job.stage = JobStage.complete
        job.status = JobStatus.completed
        job.progress = 1.0
        job.article_id = job.id
        job.events.append(
            JobEvent(
                stage=JobStage.complete,
                message="Stub complete — real research pipeline arrives in later phases.",
                at=_now(),
                meta={"stub": True},
            )
        )
        job.updated_at = _now()
        await store.update(job)
    except Exception as exc:  # noqa: BLE001 — surface stub failures to job record
        job = await store.get(job_id)
        if job is None:
            return
        job.status = JobStatus.failed
        job.stage = JobStage.failed
        job.error = str(exc)
        job.events.append(
            JobEvent(
                stage=JobStage.failed,
                message=f"Stub pipeline failed: {exc}",
                at=_now(),
            )
        )
        job.updated_at = _now()
        await store.update(job)
