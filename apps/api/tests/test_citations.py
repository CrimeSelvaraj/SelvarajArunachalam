"""Unit tests for Phase 8 citations — citekeys, CSL-JSON, APA, BibTeX."""

from __future__ import annotations

from scholarly_api.citations import (
    build_bibliography,
    cite_index_map,
    make_citekey,
    render_apa,
    source_to_csl,
)
from scholarly_api.models import ScreenDecision, SourceWork


def _work(
    sid: str,
    title: str,
    *,
    authors: list[str] | None = None,
    year: int | None = 2024,
    doi: str | None = None,
) -> SourceWork:
    return SourceWork(
        openalex_id=sid,
        title=title,
        authors=authors or ["Ada Lovelace"],
        year=year,
        doi=doi,
        landing_url=f"https://example.org/{sid}",
        source_type="work",
        screen_decision=ScreenDecision.include,
    )


def _software(full_name: str, title: str | None = None) -> SourceWork:
    return SourceWork(
        openalex_id=f"github:{full_name}",
        title=title or full_name,
        authors=[],
        year=2023,
        source_type="software",
        github_full_name=full_name,
        html_url=f"https://github.com/{full_name}",
        screen_decision=ScreenDecision.include,
        license_spdx="Apache-2.0",
    )


def test_citekey_bbt_inspired_auth_year_title():
    src = _work(
        "https://openalex.org/W1",
        "The Grounded Retrieval for Scientific QA",
        authors=["Ada Lovelace"],
        year=2024,
    )
    key = make_citekey(src)
    assert key.startswith("lovelace2024")
    assert "grounded" in key


def test_citekey_disambiguates_collisions():
    used: set[str] = set()
    a = _work("W1", "Grounded retrieval", authors=["Smith, Jane"], year=2020)
    b = _work("W2", "Grounded models", authors=["Smith, John"], year=2020)
    k1 = make_citekey(a, used=used)
    k2 = make_citekey(b, used=used)
    # Same family+year+first-title-word → disambiguator suffix
    assert k1 == "smith2020grounded"
    assert k2 == "smith2020groundeda"
    assert k1 != k2


def test_software_citekey_uses_owner_repo():
    src = _software("future-house/paper-qa")
    key = make_citekey(src)
    assert "futurehouse" in key or "future" in key
    assert "paperqa" in key
    assert "2023" in key


def test_csl_json_shape_and_apa():
    src = _work(
        "https://openalex.org/W9",
        "Citation faithfulness in RAG",
        authors=["Jane Doe", "John Smith"],
        year=2022,
        doi="10.1234/example",
    )
    csl = source_to_csl(src, "doe2022citation")
    assert csl["id"] == "doe2022citation"
    assert csl["type"] == "article-journal"
    assert csl["DOI"] == "10.1234/example"
    assert csl["issued"]["date-parts"][0][0] == 2022
    apa = render_apa(csl)
    assert "Doe" in apa
    assert "2022" in apa
    assert "Citation faithfulness" in apa
    assert "doi.org/10.1234/example" in apa


def test_build_bibliography_aligns_with_cite_index():
    sources = [
        _work("https://openalex.org/W1", "Alpha paper", year=2021),
        _software("acme/toolkit"),
        _work(
            "https://openalex.org/W2",
            "Beta paper",
            authors=["Zeta Author"],
            year=2020,
        ),
    ]
    # Include an excluded source — should not appear in index
    sources.append(
        SourceWork(
            openalex_id="https://openalex.org/W3",
            title="Excluded",
            authors=["X"],
            year=2019,
            source_type="work",
            screen_decision=ScreenDecision.exclude,
        )
    )
    indexed = cite_index_map(sources)
    assert len(indexed) == 3
    assert indexed[0].source_type == "work"
    assert indexed[-1].source_type == "software"

    bib = build_bibliography(
        sources,
        citation_style="apa",
        cited_source_ids=["https://openalex.org/W1", "github:acme/toolkit"],
    )
    assert len(bib.entries) == 3
    assert [e.n for e in bib.entries] == [1, 2, 3]
    assert bib.entries[0].source_id == indexed[0].openalex_id
    assert bib.entries[0].citekey
    assert bib.csl_json[0]["id"] == bib.entries[0].citekey
    assert "@article{" in bib.bibtex or "@misc{" in bib.bibtex
    assert "id=\"ref-1\"" in bib.html
    assert bib.entries[0].cited_in_article is True
    # W2 not in cited_source_ids
    w2 = next(e for e in bib.entries if e.source_id == "https://openalex.org/W2")
    assert w2.cited_in_article is False


def test_bibtex_contains_citekeys():
    sources = [_work("W1", "Title One"), _software("org/repo")]
    bib = build_bibliography(sources)
    for e in bib.entries:
        assert e.citekey in bib.bibtex
        assert e.citekey in e.bibtex
