"""Research job pipeline — discovery → screen → evidence → compose → cite."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import httpx

from scholarly_api.citations import build_bibliography
from scholarly_api.composer import compose_article
from scholarly_api.evidence_pack import build_evidence_pack
from scholarly_api.github_client import search_repositories
from scholarly_api.models import JobEvent, JobStage, JobStatus, ScreenDecision
from scholarly_api.openalex import search_works
from scholarly_api.paperqa_adapter import analyze_evidence_pack
from scholarly_api.screening import screen_sources
from scholarly_api.store import JobStore


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

        # --- Phase 7: article composer ---
        job = await store.get(job_id)
        if job is None:
            return
        job.stage = JobStage.draft
        job.progress = 0.78
        job.events.append(
            JobEvent(
                stage=JobStage.draft,
                message=(
                    "Composing scholarly news article from screened sources "
                    "and evidence (claim→source map enforced)…"
                ),
                at=_now(),
                meta={},
            )
        )
        job.updated_at = _now()
        await store.update(job)

        article = await compose_article(job.topic, job.sources, job.evidence)
        job = await store.get(job_id)
        if job is None:
            return
        job.article = article
        job.progress = 0.88
        if article.status == "ready":
            draft_msg = (
                f"Draft ready via {article.method} — "
                f"{len(article.sections)} sections, {len(article.claims)} grounded claim"
                f"{'' if len(article.claims) == 1 else 's'}"
                + (
                    f", {len(article.refused_claims)} refused"
                    if article.refused_claims
                    else ""
                )
                + "."
            )
        elif article.status == "heuristic":
            draft_msg = (
                f"Draft composed heuristically ({article.skip_reason or 'no LLM key'}) — "
                f"{len(article.claims)} claim"
                f"{'' if len(article.claims) == 1 else 's'} mapped to sources."
            )
        else:
            draft_msg = (
                f"Compose finished with status={article.status}"
                + (f" — {article.skip_reason}" if article.skip_reason else ".")
            )
        job.events.append(
            JobEvent(
                stage=JobStage.draft,
                message=draft_msg,
                at=_now(),
                meta={
                    "status": article.status,
                    "method": article.method,
                    "claim_count": len(article.claims),
                    "section_count": len(article.sections),
                    "refused_count": len(article.refused_claims),
                    "cited_source_count": len(article.cited_source_ids),
                },
            )
        )
        job.updated_at = _now()
        await store.update(job)

        # --- Phase 8: citations & bibliography ---
        job = await store.get(job_id)
        if job is None:
            return
        job.stage = JobStage.cite
        job.progress = 0.94
        job.events.append(
            JobEvent(
                stage=JobStage.cite,
                message=(
                    "Building CSL-JSON library, stable citekeys, "
                    f"and {(job.options.citation_style or 'apa').upper()} bibliography…"
                ),
                at=_now(),
                meta={"citation_style": job.options.citation_style},
            )
        )
        job.updated_at = _now()
        await store.update(job)

        bibliography = build_bibliography(
            job.sources,
            citation_style=job.options.citation_style,
            cited_source_ids=article.cited_source_ids if article else None,
        )
        job = await store.get(job_id)
        if job is None:
            return
        job.bibliography = bibliography
        # Enrich article markdown Sources appendix with APA lines when present
        if job.article and bibliography.entries:
            from scholarly_api.composer import _build_markdown, _cite_index_map

            art = job.article
            apa_lines = [
                f"[{e.citekey}] {e.apa}" for e in bibliography.entries
            ]
            art.markdown = _build_markdown(
                art.title,
                art.sections,
                _cite_index_map(job.sources),
                bibliography_lines=apa_lines,
            )
            job.article = art
        job.progress = 0.97
        job.events.append(
            JobEvent(
                stage=JobStage.cite,
                message=(
                    f"Bibliography ready — {len(bibliography.entries)} CSL-JSON item"
                    f"{'' if len(bibliography.entries) == 1 else 's'}, "
                    f"style={bibliography.style}, method={bibliography.method}; "
                    "BibTeX export available."
                ),
                at=_now(),
                meta={
                    "entry_count": len(bibliography.entries),
                    "style": bibliography.style,
                    "method": bibliography.method,
                    "citekeys": [e.citekey for e in bibliography.entries[:12]],
                },
            )
        )
        job.updated_at = _now()
        await store.update(job)

        await asyncio.sleep(0.25)
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
        art = job.article
        bib = job.bibliography
        job.events.append(
            JobEvent(
                stage=JobStage.complete,
                message=(
                    f"Article ready — {work_n} paper"
                    f"{'' if work_n == 1 else 's'}"
                    f" and {soft_n} software repo"
                    f"{'' if soft_n == 1 else 's'} cited"
                    + (
                        f"; compose {art.method} ({art.status})"
                        if art
                        else ""
                    )
                    + (
                        f"; bibliography {len(bib.entries)} ({bib.style})"
                        if bib
                        else ""
                    )
                    + (
                        f"; evidence {ev.method}"
                        if ev
                        else ""
                    )
                    + "."
                ),
                at=_now(),
                meta={
                    "sources": len(job.sources),
                    "included": len(included),
                    "works_included": work_n,
                    "software_included": soft_n,
                    "screening": job.screening.model_dump() if job.screening else None,
                    "evidence": ev.model_dump() if ev else None,
                    "article": {
                        "status": art.status,
                        "method": art.method,
                        "claim_count": len(art.claims),
                        "title": art.title,
                    }
                    if art
                    else None,
                    "bibliography": {
                        "entry_count": len(bib.entries),
                        "style": bib.style,
                        "method": bib.method,
                    }
                    if bib
                    else None,
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
