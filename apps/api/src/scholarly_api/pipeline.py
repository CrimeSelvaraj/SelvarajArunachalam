"""Research job pipeline — real OpenAlex search; later stages still stubbed."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import httpx

from scholarly_api.models import JobEvent, JobStage, JobStatus
from scholarly_api.openalex import search_works
from scholarly_api.store import JobStore

# Post-discovery stages remain simulated until Phases 4–8.
STUB_AFTER_SEARCH: list[tuple[JobStage, str, float, float]] = [
    (JobStage.screen, "Screening and ranking sources by relevance… (stub)", 0.35, 0.7),
    (JobStage.read, "Reading open-access abstracts and evidence snippets… (stub)", 0.55, 0.8),
    (JobStage.draft, "Drafting a scholarly news narrative… (stub)", 0.78, 0.7),
    (JobStage.cite, "Attaching citations and bibliography stubs… (stub)", 0.92, 0.5),
]


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def run_pipeline(store: JobStore, job_id: str) -> None:
    job = await store.get(job_id)
    if job is None:
        return

    job.status = JobStatus.running
    job.stage = JobStage.search
    job.progress = 0.08
    job.events.append(
        JobEvent(
            stage=JobStage.search,
            message="Searching OpenAlex for candidate works…",
            at=_now(),
            meta={"provider": "openalex"},
        )
    )
    job.updated_at = _now()
    await store.update(job)

    try:
        works = await search_works(job.topic, depth=job.options.depth)
        job = await store.get(job_id)
        if job is None:
            return

        job.sources = works
        job.progress = 0.22
        oa_count = sum(1 for w in works if w.is_oa)
        pdf_count = sum(1 for w in works if w.pdf_url)
        job.events.append(
            JobEvent(
                stage=JobStage.search,
                message=(
                    f"OpenAlex returned {len(works)} work"
                    f"{'' if len(works) == 1 else 's'}"
                    f" ({oa_count} OA, {pdf_count} with PDF hints)."
                ),
                at=_now(),
                meta={
                    "provider": "openalex",
                    "count": len(works),
                    "oa_count": oa_count,
                    "pdf_count": pdf_count,
                },
            )
        )
        job.updated_at = _now()
        await store.update(job)

        for stage, message, progress, delay in STUB_AFTER_SEARCH:
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

        await asyncio.sleep(0.4)
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
                message=(
                    "Discovery complete — OpenAlex candidates saved. "
                    "Screening, PaperQA evidence, and composition arrive in later phases."
                ),
                at=_now(),
                meta={"sources": len(job.sources)},
            )
        )
        job.updated_at = _now()
        await store.update(job)
    except httpx.HTTPStatusError as exc:
        await _fail(
            store,
            job_id,
            f"OpenAlex HTTP {exc.response.status_code}: {exc.response.text[:240]}",
        )
    except httpx.HTTPError as exc:
        await _fail(store, job_id, f"OpenAlex request failed: {exc}")
    except Exception as exc:  # noqa: BLE001 — surface pipeline failures on the job
        await _fail(store, job_id, str(exc))


async def _fail(store: JobStore, job_id: str, message: str) -> None:
    job = await store.get(job_id)
    if job is None:
        return
    job.status = JobStatus.failed
    job.stage = JobStage.failed
    job.error = message
    job.events.append(
        JobEvent(
            stage=JobStage.failed,
            message=f"Pipeline failed: {message}",
            at=_now(),
        )
    )
    job.updated_at = _now()
    await store.update(job)
