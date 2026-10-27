"""Research job pipeline — discovery + screening + evidence; draft/cite stubbed."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import httpx

from scholarly_api.evidence_pack import build_evidence_pack
from scholarly_api.github_client import search_repositories
from scholarly_api.models import JobEvent, JobStage, JobStatus, ScreenDecision
from scholarly_api.openalex import search_works
from scholarly_api.paperqa_adapter import analyze_evidence_pack
from scholarly_api.screening import screen_sources
from scholarly_api.store import JobStore

# Post-evidence stages remain simulated until Phases 7–8.
STUB_AFTER_READ: list[tuple[JobStage, str, float, float]] = [
    (JobStage.draft, "Drafting a scholarly news narrative… (stub)", 0.78, 0.55),
    (JobStage.cite, "Attaching citations and bibliography stubs… (stub)", 0.92, 0.4),
]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _merge_sources(works, repos):
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
            meta={
                "providers": (
                    ["openalex", "github"] if job.options.include_github else ["openalex"]
                )
            },
        )
    )
    job.updated_at = _now()
    await store.update(job)

    try:
        job = await store.get(job_id)
        if job is None:
            return

        include_github = job.options.include_github
        openalex_task = asyncio.create_task(
            search_works(job.topic, depth=job.options.depth)
        )
        github_task = (
            asyncio.create_task(search_repositories(job.topic))
            if include_github
            else None
        )

        works = []
        repos = []
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

        # --- Phase 5: screening (ASReview-inspired) ---
        job = await store.get(job_id)
        if job is None:
            return
        job.stage = JobStage.screen
        job.progress = 0.32
        job.events.append(
            JobEvent(
                stage=JobStage.screen,
                message="Screening candidates — ranking, deduping, capping for deep read…",
                at=_now(),
                meta={"candidates": len(job.sources)},
            )
        )
        job.updated_at = _now()
        await store.update(job)

        job = await store.get(job_id)
        if job is None:
            return

        screened, summary = await screen_sources(job.topic, job.sources, job.options)
        job.sources = screened
        job.screening = summary
        job.progress = 0.42
        job.events.append(
            JobEvent(
                stage=JobStage.screen,
                message=(
                    f"Screened {summary.candidate_count} candidates via {summary.method}: "
                    f"{summary.included_count} included, "
                    f"{summary.excluded_count} excluded, "
                    f"{summary.duplicate_count} duplicate"
                    f"{'' if summary.duplicate_count == 1 else 's'} "
                    f"(deep-read cap {summary.max_include})."
                ),
                at=_now(),
                meta=summary.model_dump(),
            )
        )
        job.updated_at = _now()
        await store.update(job)

        # --- Phase 6: evidence pack + PaperQA adapter ---
        job = await store.get(job_id)
        if job is None:
            return
        job.stage = JobStage.read
        job.progress = 0.5
        included_n = sum(
            1 for s in job.sources if s.screen_decision == ScreenDecision.include
        )
        job.events.append(
            JobEvent(
                stage=JobStage.read,
                message=(
                    f"Building evidence pack for {included_n} screened-in source"
                    f"{'' if included_n == 1 else 's'} "
                    "(OA PDFs when allowed; abstracts/READMEs otherwise)…"
                ),
                at=_now(),
                meta={"included": included_n},
            )
        )
        job.updated_at = _now()
        await store.update(job)

        job = await store.get(job_id)
        if job is None:
            return

        pack = await build_evidence_pack(job.id, job.sources)
        job.progress = 0.58
        job.events.append(
            JobEvent(
                stage=JobStage.read,
                message=(
                    f"Evidence pack ready — {len(pack.files)} file"
                    f"{'' if len(pack.files) == 1 else 's'} "
                    f"({pack.pdf_count} PDF, {pack.text_count} text) in {pack.directory}."
                ),
                at=_now(),
                meta={
                    "directory": str(pack.directory),
                    "file_count": len(pack.files),
                    "pdf_count": pack.pdf_count,
                    "text_count": pack.text_count,
                    "notes": pack.notes[:20],
                },
            )
        )
        job.updated_at = _now()
        await store.update(job)

        job = await store.get(job_id)
        if job is None:
            return
        job.progress = 0.62
        job.events.append(
            JobEvent(
                stage=JobStage.read,
                message="Running PaperQA adapter over the evidence pack…",
                at=_now(),
                meta={},
            )
        )
        job.updated_at = _now()
        await store.update(job)

        evidence = await analyze_evidence_pack(job.topic, pack)
        job = await store.get(job_id)
        if job is None:
            return
        # Re-attach evidence_files written onto source objects during pack build
        id_to_files = {
            s.openalex_id: list(s.evidence_files) for s in job.sources if s.evidence_files
        }
        # build_evidence_pack mutated the same SourceWork instances still on job.sources
        job.evidence = evidence
        job.progress = 0.7
        if evidence.status == "ready":
            msg = (
                f"PaperQA indexed the pack — {len(evidence.findings)} findings, "
                f"{len(evidence.quotes)} quote"
                f"{'' if len(evidence.quotes) == 1 else 's'} linked to sources."
            )
        elif evidence.status == "paperqa_skipped":
            msg = (
                f"PaperQA skipped ({evidence.skip_reason or 'no LLM key'}). "
                f"Kept {len(evidence.quotes)} heuristic excerpt"
                f"{'' if len(evidence.quotes) == 1 else 's'} from the evidence pack."
            )
        else:
            msg = (
                f"Evidence step finished with status={evidence.status}"
                + (f" — {evidence.skip_reason}" if evidence.skip_reason else ".")
            )
        job.events.append(
            JobEvent(
                stage=JobStage.read,
                message=msg,
                at=_now(),
                meta={
                    "status": evidence.status,
                    "method": evidence.method,
                    "quote_count": len(evidence.quotes),
                    "finding_count": len(evidence.findings),
                    "skip_reason": evidence.skip_reason,
                    "sources_with_files": len(id_to_files),
                },
            )
        )
        job.updated_at = _now()
        await store.update(job)

        for stage, message, progress, delay in STUB_AFTER_READ:
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

        await asyncio.sleep(0.3)
        job = await store.get(job_id)
        if job is None:
            return
        job.stage = JobStage.complete
        job.status = JobStatus.completed
        job.progress = 1.0
        job.article_id = job.id
        included = [
            s for s in job.sources if s.screen_decision == ScreenDecision.include
        ]
        work_n = sum(1 for s in included if s.source_type == "work")
        soft_n = sum(1 for s in included if s.source_type == "software")
        ev = job.evidence
        job.events.append(
            JobEvent(
                stage=JobStage.complete,
                message=(
                    f"Evidence pack complete — {work_n} paper"
                    f"{'' if work_n == 1 else 's'}"
                    f" and {soft_n} software repo"
                    f"{'' if soft_n == 1 else 's'} read"
                    + (
                        f"; PaperQA {ev.method} ({ev.status})"
                        if ev
                        else ""
                    )
                    + ". Article composition arrives in Phase 7."
                ),
                at=_now(),
                meta={
                    "sources": len(job.sources),
                    "included": len(included),
                    "works_included": work_n,
                    "software_included": soft_n,
                    "screening": job.screening.model_dump() if job.screening else None,
                    "evidence": ev.model_dump() if ev else None,
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
