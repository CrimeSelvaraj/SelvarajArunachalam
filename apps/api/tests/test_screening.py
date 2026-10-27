"""Unit tests for ASReview-inspired screening (no network)."""

from __future__ import annotations

import asyncio

from scholarly_api.models import JobOptions, ScreenDecision, SourceWork
from scholarly_api.screening import (
    default_screen_max,
    normalize_doi,
    normalize_title,
    screen_sources,
)


def _work(
    *,
    oid: str,
    title: str,
    doi: str | None = None,
    abstract: str | None = None,
    cites: int = 0,
    is_oa: bool = False,
) -> SourceWork:
    return SourceWork(
        openalex_id=oid,
        title=title,
        doi=doi,
        abstract_snippet=abstract,
        cited_by_count=cites,
        is_oa=is_oa,
        source_type="work",
    )


def _repo(
    *,
    name: str,
    title: str,
    stars: int = 0,
    readme: str | None = None,
) -> SourceWork:
    return SourceWork(
        openalex_id=f"github:{name}",
        title=title,
        github_full_name=name,
        html_url=f"https://github.com/{name}",
        stars=stars,
        readme_snippet=readme,
        source_type="software",
    )


def test_normalize_doi_and_title() -> None:
    assert normalize_doi("https://doi.org/10.1000/XYZ") == "10.1000/xyz"
    assert normalize_title("Hello, World!!!") == "hello world"


def test_default_screen_max() -> None:
    assert default_screen_max("quick") == 12
    assert default_screen_max("deep") == 18


def test_dedupe_and_cap() -> None:
    sources = [
        _work(
            oid="W1",
            title="CRISPR genome editing tools for disease",
            doi="https://doi.org/10.1000/abc",
            abstract="CRISPR Cas9 genome editing in humans",
            cites=120,
            is_oa=True,
        ),
        _work(
            oid="W2",
            title="CRISPR genome editing tools for disease",
            doi="10.1000/abc",
            abstract="Same DOI duplicate",
            cites=5,
        ),
        _work(
            oid="W3",
            title="Unrelated baking recipes",
            abstract="flour sugar oven",
            cites=1,
        ),
        _repo(
            name="org/crispr-toolkit",
            title="crispr-toolkit",
            stars=900,
            readme="Genome editing CRISPR library",
        ),
        _repo(
            name="org/baking-app",
            title="baking-app",
            stars=3,
            readme="Cookie recipes",
        ),
        _work(
            oid="W4",
            title="CRISPR delivery nanoparticles",
            abstract="genome editing delivery CRISPR tools",
            cites=40,
            is_oa=True,
        ),
        _work(
            oid="W5",
            title="Base editing in sickle cell disease",
            abstract="CRISPR base editing clinical genome",
            cites=80,
            is_oa=True,
        ),
    ]

    async def run() -> None:
        out, summary = await screen_sources(
            "CRISPR genome editing tools",
            sources,
            JobOptions(depth="quick", screen_max=4),
        )
        assert summary.method == "heuristic"
        assert summary.max_include == 4
        assert summary.duplicate_count == 1
        decisions = {s.openalex_id: s.screen_decision for s in out}
        assert decisions["W2"] == ScreenDecision.duplicate
        included = [s for s in out if s.screen_decision == ScreenDecision.include]
        assert len(included) == 4
        assert all(s.screen_rationale for s in out)
        assert all(s.relevance_score is not None for s in out)
        # Top CRISPR paper + competitive CRISPR software should be included
        assert decisions["W1"] == ScreenDecision.include
        assert decisions["github:org/crispr-toolkit"] == ScreenDecision.include
        assert decisions["github:org/baking-app"] == ScreenDecision.exclude
        assert decisions["W3"] == ScreenDecision.exclude

    asyncio.run(run())
