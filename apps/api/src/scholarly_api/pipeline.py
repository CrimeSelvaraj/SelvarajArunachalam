"""Research job pipeline — OpenAlex + GitHub discovery; later stages stubbed."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import httpx

from scholarly_api.github_client import search_repositories
from scholarly_api.models import JobEvent, JobStage, JobStatus, SourceWork
from scholarly_api.openalex import search_works
from scholarly_api.store import JobStore

# Post-discovery stages remain simulated until Phases 5–8.
STUB_AFTER_SEARCH: list[tuple[JobStage, str, float, float]] = [
    (JobStage.screen, "Screening and ranking sources by relevance… (stub)", 0.35, 0.7),
    (JobStage.read, "Reading open-access abstracts and evidence snippets… (stub)", 0.55, 0.8),
    (JobStage.draft, "Drafting a scholarly news narrative… (stub)", 0.78, 0.7),
    (JobStage.cite, "Attaching citations and bibliography stubs… (stub)", 0.92, 0.5),
]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _merge_sources(works: list[SourceWork], repos: list[SourceWork]) -> list[SourceWork]:
    """Scholarly works first, then software repos (both ranked by provider)."""
    return [*works, *repos]


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
            message="Searching OpenAlex and GitHub for candidate sources…",
            at=_now(),
            meta={"providers": ["openalex", "github"] if job.options.include_github else ["openalex"]},
        )
    )
    job.updated_at = _now()
    await store.update(job)

    try:
        job = await store.get(job_id)
        if job is None:
            return

        include_github = job.options.include_github
        openalex_task = asyncio.create_task(search_works(job.topic, depth=job.options.depth))
        github_task = (
            asyncio.create_task(search_repositories(job.topic))
            if include_github
            else None
        )

        works: list[SourceWork] = []
        repos: list[SourceWork] = []
        github_error: str | None = None

        try:
            works = await openalex_task
        except httpx.HTTPStatusError as exc:
            await _fail(
                store,
                job_id,
                f"OpenAlex HTTP {exc.response.status_code}: {exc.response.text[:240]}",
            )
            return
        except httpx.HTTPError as exc:
            await _fail(store, job_id, f"OpenAlex request failed: {exc}")
            return

        if github_task is not None:
            try:
                repos = await github_task
            except httpx.HTTPStatusError as exc:
                github_error = (
                    f"GitHub HTTP {exc.response.status_code}: {exc.response.text[:200]}"
                )
            except httpx.HTTPError as exc:
                github_error = f"GitHub request failed: {exc}"
            except Exception as exc:  # noqa: BLE001
                github_error = str(exc)

        job = await store.get(job_id)
        if job is None:
            return

        job.sources = _merge_sources(works, repos)
        job.progress = 0.22
        oa_count = sum(1 for w in works if w.is_oa)
        pdf_count = sum(1 for w in works if w.pdf_url)
        cff_count = sum(1 for r in repos if r.citation_cff)

        job.events.append(
            JobEvent(
                stage=JobStage.search,
                message=(
                    f"OpenAlex returned {len(works)} work"
                    f"{'' if len(works) == 1 else 's'}"
                    f" ({oa_count} OA, {pdf_count} with PDF hints)."
                    + (
                        f" GitHub returned {len(repos)} repo"
                        f"{'' if len(repos) == 1 else 's'}"
                        f" ({cff_count} with CITATION.cff)."
                        if include_github and not github_error
                        else (
                            " GitHub search skipped."
                            if not include_github
                            else f" GitHub search failed ({github_error})."
                        )
                    )
                ),
                at=_now(),
                meta={
                    "openalex_count": len(works),
                    "oa_count": oa_count,
                    "pdf_count": pdf_count,
                    "github_count": len(repos),
                    "citation_cff_count": cff_count,
                    "include_github": include_github,
                    "github_error": github_error,
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
        work_n = sum(1 for s in job.sources if s.source_type == "work")
        soft_n = sum(1 for s in job.sources if s.source_type == "software")
        job.events.append(
            JobEvent(
                stage=JobStage.complete,
                message=(
                    f"Discovery complete — {work_n} paper"
                    f"{'' if work_n == 1 else 's'}"
                    f" and {soft_n} software repo"
                    f"{'' if soft_n == 1 else 's'} saved. "
                    "Screening, PaperQA evidence, and composition arrive in later phases."
                ),
                at=_now(),
                meta={
                    "sources": len(job.sources),
                    "works": work_n,
                    "software": soft_n,
                },
            )
        )
        job.updated_at = _now()
        await store.update(job)
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
