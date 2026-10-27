"""Unit tests for article composer (heuristic path + claim→source enforcement)."""

from __future__ import annotations

import asyncio

from scholarly_api.composer import (
    _heuristic_compose,
    _markdown_to_html,
    _refuse_sensational,
    compose_article,
)
from scholarly_api.models import (
    EvidencePackSummary,
    EvidenceQuote,
    ScreenDecision,
    SourceWork,
)


def _source(
    sid: str,
    title: str,
    *,
    kind: str = "work",
    decision: ScreenDecision = ScreenDecision.include,
    snippet: str | None = None,
) -> SourceWork:
    return SourceWork(
        openalex_id=sid,
        title=title,
        authors=["Ada Lovelace"],
        year=2024,
        abstract_snippet=snippet,
        source_type=kind,
        screen_decision=decision,
        github_full_name=title if kind == "software" else None,
        html_url=f"https://github.com/{title}" if kind == "software" else None,
        landing_url=f"https://example.org/{sid}",
    )


def test_refuse_sensational_detects_miracle():
    assert _refuse_sensational("This miracle cure ends disease") is not None
    assert _refuse_sensational("Base editing reduced off-target rates.") is None


def test_markdown_to_html_adds_cite_links():
    html = _markdown_to_html("Finding one [1] and two [2].")
    assert 'href="#ref-1"' in html
    assert 'href="#ref-2"' in html
    assert "<p>" in html


def test_heuristic_compose_maps_claims_to_sources():
    sources = [
        _source(
            "https://openalex.org/W1",
            "Grounded retrieval for scientific QA",
            snippet="Retrieval-augmented models improve citation faithfulness.",
        ),
        _source(
            "github:future-house/paper-qa",
            "future-house/paper-qa",
            kind="software",
            snippet="PaperQA answers questions from scientific documents with citations.",
        ),
    ]
    evidence = EvidencePackSummary(
        status="paperqa_skipped",
        method="heuristic_excerpts",
        file_count=2,
        text_count=2,
        source_count=2,
        quotes=[
            EvidenceQuote(
                id="q1",
                source_id="https://openalex.org/W1",
                quote=(
                    "Retrieval-augmented models improve citation faithfulness "
                    "on scientific question answering benchmarks."
                ),
                prompt_key="excerpt",
            ),
            EvidenceQuote(
                id="q2",
                source_id="github:future-house/paper-qa",
                quote=(
                    "PaperQA answers questions from scientific documents "
                    "with grounded citations for researchers."
                ),
                prompt_key="excerpt",
            ),
        ],
        findings=[],
    )
    article = _heuristic_compose("scientific literature RAG", sources, evidence)
    assert article.status == "heuristic"
    assert article.method == "heuristic_template"
    assert article.markdown
    assert article.html
    assert "What the evidence shows" in article.markdown or "Why it matters" in article.markdown
    assert "[1]" in article.markdown
    assert len(article.claims) >= 1
    for claim in article.claims:
        assert claim.source_ids
        assert claim.supported is True
    assert "Sources" in article.markdown


def test_sensational_unsupported_quote_refused():
    sources = [
        _source("W1", "Ordinary study", snippet="Modest improvements were observed.")
    ]
    evidence = EvidencePackSummary(
        status="paperqa_skipped",
        method="heuristic_excerpts",
        file_count=1,
        text_count=1,
        source_count=1,
        quotes=[
            EvidenceQuote(
                id="q-bad",
                source_id="W1",
                quote="This miracle cure is completely safe and 100% effective overnight.",
                prompt_key="excerpt",
            ),
            EvidenceQuote(
                id="q-ok",
                source_id="W1",
                quote=(
                    "The trial reported modest hemoglobin improvements "
                    "in a small cohort of patients."
                ),
                prompt_key="excerpt",
            ),
        ],
    )
    article = _heuristic_compose("gene therapy", sources, evidence)
    # Bad quote should be refused; good quote can appear
    joined_refused = " ".join(article.refused_claims).lower()
    assert "miracle" in joined_refused or any(
        "miracle" in c.lower() for c in article.refused_claims
    )
    assert "modest hemoglobin" in article.markdown.lower() or any(
        "modest" in c.text.lower() for c in article.claims
    )


def test_compose_article_degrades_without_llm(monkeypatch):
    for key in (
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "GEMINI_API_KEY",
        "GOOGLE_API_KEY",
        "AZURE_API_KEY",
        "OPENROUTER_API_KEY",
        "LITELLM_API_KEY",
    ):
        monkeypatch.delenv(key, raising=False)

    sources = [
        _source(
            "W9",
            "PaperQA scientific RAG",
            snippet="PaperQA indexes PDFs and returns grounded answers for researchers.",
        )
    ]
    evidence = EvidencePackSummary(
        status="paperqa_skipped",
        method="heuristic_excerpts",
        file_count=1,
        text_count=1,
        source_count=1,
        quotes=[
            EvidenceQuote(
                id="q9",
                source_id="W9",
                quote=(
                    "PaperQA indexes PDFs and returns grounded answers "
                    "for researchers working with scientific corpora."
                ),
            )
        ],
    )
    article = asyncio.run(compose_article("PaperQA", sources, evidence))
    assert article.status == "heuristic"
    assert article.skip_reason and "OPENAI_API_KEY" in article.skip_reason


def test_compose_fails_without_sources():
    article = asyncio.run(compose_article("empty topic", [], None))
    assert article.status == "failed"
    assert article.skip_reason
