"""Unit tests for Phase 9 pandoc export (MD / HTML / DOCX)."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from scholarly_api.citations import build_bibliography
from scholarly_api.export import (
    article_export_markdown,
    export_article,
    pandoc_available,
    _rewrite_numeric_cites_to_pandoc,
)
from scholarly_api.models import (
    ArticleSection,
    ComposedArticle,
    JobOptions,
    JobRecord,
    JobStage,
    JobStatus,
    ScreenDecision,
    SourceWork,
)


def _work(sid: str, title: str, *, year: int = 2024) -> SourceWork:
    return SourceWork(
        openalex_id=sid,
        title=title,
        authors=["Ada Lovelace"],
        year=year,
        doi=f"10.1/{sid}",
        landing_url=f"https://example.org/{sid}",
        source_type="work",
        screen_decision=ScreenDecision.include,
    )


def _job_with_article() -> JobRecord:
    sources = [
        _work("W1", "Grounded retrieval for science"),
        _work("W2", "Open corpora for news"),
    ]
    bib = build_bibliography(sources, citation_style="apa", cited_source_ids=["W1", "W2"])
    sections = [
        ArticleSection(
            key="lede",
            heading=None,
            markdown="Open research shows progress on grounded writing. [1]",
            claim_ids=[],
        ),
        ArticleSection(
            key="body",
            heading="What the evidence shows",
            markdown="Corpora matter for transparency. [2]",
            claim_ids=[],
        ),
    ]
    apa_lines = [f"[{e.citekey}] {e.apa}" for e in bib.entries]
    md_parts = [
        "# Grounded scholarly news",
        "",
        "Open research shows progress on grounded writing. [1]",
        "",
        "## What the evidence shows",
        "",
        "Corpora matter for transparency. [2]",
        "",
        "## References",
        "",
    ]
    for i, line in enumerate(apa_lines, start=1):
        md_parts.append(f"{i}. {line}")
    md_parts.append("")
    article = ComposedArticle(
        title="Grounded scholarly news",
        status="heuristic",
        method="heuristic_template",
        markdown="\n".join(md_parts) + "\n",
        html="<p>Open research shows progress on grounded writing. [1]</p>",
        sections=sections,
        claims=[],
        cited_source_ids=["W1", "W2"],
    )
    now = datetime.now(timezone.utc)
    return JobRecord(
        id="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        topic="grounded scholarly news",
        options=JobOptions(),
        status=JobStatus.completed,
        stage=JobStage.complete,
        progress=1.0,
        sources=sources,
        article=article,
        bibliography=bib,
        article_id="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        created_at=now,
        updated_at=now,
    )


def test_article_export_markdown_includes_references():
    job = _job_with_article()
    md = article_export_markdown(job.article, job.bibliography)
    assert md.startswith("# Grounded scholarly news")
    assert "## References" in md
    assert "[1]" in md
    assert "lovelace" in md.lower()


def test_rewrite_numeric_cites_to_pandoc_citekeys():
    job = _job_with_article()
    assert job.bibliography is not None
    rewritten = _rewrite_numeric_cites_to_pandoc(
        job.article.markdown,
        job.bibliography,
    )
    assert "[@" in rewritten
    assert "## References" not in rewritten
    key1 = job.bibliography.entries[0].citekey
    assert f"[@{key1}]" in rewritten


def test_export_markdown_preserves_numeric_cites():
    job = _job_with_article()
    result = export_article(job, "md")
    text = result.content.decode("utf-8")
    assert "Grounded scholarly news" in text
    assert "## References" in text
    assert "[1]" in text
    assert "\\[1\\]" not in text  # must not be GFM-escaped
    assert result.filename.endswith(".md")
    assert "markdown" in result.media_type
    assert "raw_markdown" in result.method


@pytest.mark.skipif(not pandoc_available(), reason="pandoc not installed")
def test_export_html_opens_with_citations():
    job = _job_with_article()
    result = export_article(job, "html")
    html = result.content.decode("utf-8")
    assert result.filename.endswith(".html")
    assert "<html" in html.lower()
    # Either citeproc bibliography or embedded References
    assert (
        "csl-entry" in html
        or "References" in html
        or "Lovelace" in html
        or "lovelace" in html.lower()
    )
    assert result.method.startswith("pandoc")


@pytest.mark.skipif(not pandoc_available(), reason="pandoc not installed")
def test_export_docx_is_ole_zip():
    job = _job_with_article()
    result = export_article(job, "docx")
    assert result.filename.endswith(".docx")
    # DOCX is a ZIP (PK..)
    assert result.content[:2] == b"PK"
    assert len(result.content) > 1000
    assert "wordprocessingml" in result.media_type
    assert result.method.startswith("pandoc")


def test_export_without_article_raises():
    now = datetime.now(timezone.utc)
    job = JobRecord(
        id="bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee",
        topic="empty",
        options=JobOptions(),
        status=JobStatus.running,
        stage=JobStage.draft,
        progress=0.5,
        created_at=now,
        updated_at=now,
    )
    with pytest.raises(ValueError, match="Article not ready"):
        export_article(job, "md")
