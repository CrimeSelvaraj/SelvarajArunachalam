"""Unit tests for evidence pack + PaperQA adapter degrade path (no LLM)."""

from __future__ import annotations

import asyncio
from pathlib import Path

from scholarly_api.evidence_pack import (
    PackFile,
    EvidencePackResult,
    _write_text,
    job_pack_dir,
)
from scholarly_api.paperqa_adapter import (
    analyze_evidence_pack,
    llm_keys_available,
    _heuristic_from_pack,
)


def test_job_pack_dir_creates(tmp_path, monkeypatch):
    monkeypatch.setenv("EVIDENCE_PACK_ROOT", str(tmp_path))
    # Re-import path resolution uses env at module load for DEFAULT — call job_pack_dir
    # which uses pack_root() reading DEFAULT_PACK_ROOT. Override via monkeypatch on module.
    import scholarly_api.evidence_pack as ep

    monkeypatch.setattr(ep, "DEFAULT_PACK_ROOT", tmp_path)
    path = job_pack_dir("abc-123")
    assert path.exists()
    assert path.parent == tmp_path


def test_heuristic_excerpts_from_text_files(tmp_path):
    abs_path = tmp_path / "01_work_example_abstract.txt"
    _write_text(
        abs_path,
        "Title: Example\n\nAbstract:\n"
        "Base editing corrected the sickle mutation in hematopoietic stem cells. "
        "Off-target rates were low in the reported assays. Further trials are needed.",
    )
    readme = tmp_path / "02_sw_paper-qa_readme.md"
    _write_text(
        readme,
        "# future-house/paper-qa\nURL: https://github.com/future-house/paper-qa\n\n"
        "PaperQA answers questions from scientific documents with citations. "
        "It indexes PDFs and returns grounded answers for researchers.",
    )
    pack = EvidencePackResult(
        directory=tmp_path,
        files=[
            PackFile(
                source_id="https://openalex.org/W123",
                relative_path=abs_path.name,
                kind="abstract",
                bytes=abs_path.stat().st_size,
                title="Example",
                absolute_path=abs_path,
            ),
            PackFile(
                source_id="github:future-house/paper-qa",
                relative_path=readme.name,
                kind="readme",
                bytes=readme.stat().st_size,
                title="paper-qa",
                absolute_path=readme,
            ),
        ],
        source_count=2,
    )
    summary = _heuristic_from_pack("CRISPR base editing", pack)
    assert summary.status == "paperqa_skipped"
    assert summary.method == "heuristic_excerpts"
    assert len(summary.quotes) >= 1
    assert summary.quotes[0].source_id
    assert any(f.key == "key_findings" for f in summary.findings)
    assert summary.skip_reason and "OPENAI_API_KEY" in summary.skip_reason


def test_analyze_degrades_without_llm_key(tmp_path, monkeypatch):
    for key in (
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "GEMINI_API_KEY",
        "GOOGLE_API_KEY",
        "AZURE_API_KEY",
        "OPENROUTER_API_KEY",
    ):
        monkeypatch.delenv(key, raising=False)

    assert llm_keys_available() is False

    abs_path = tmp_path / "abstract.txt"
    _write_text(
        abs_path,
        "Abstract:\nGrounded retrieval improves citation faithfulness in scientific QA systems. "
        "Benchmarks show gains over naive chunking approaches.",
    )
    pack = EvidencePackResult(
        directory=tmp_path,
        files=[
            PackFile(
                source_id="W1",
                relative_path="abstract.txt",
                kind="abstract",
                bytes=abs_path.stat().st_size,
                title="QA",
                absolute_path=abs_path,
            )
        ],
        source_count=1,
    )
    summary = asyncio.run(analyze_evidence_pack("scientific QA", pack))
    assert summary.status == "paperqa_skipped"
    assert summary.method == "heuristic_excerpts"
    assert len(summary.quotes) >= 1


def test_empty_pack_fails_clearly():
    pack = EvidencePackResult(
        directory=Path("/tmp/empty-pack"),
        files=[],
        source_count=0,
    )
    summary = asyncio.run(analyze_evidence_pack("anything", pack))
    assert summary.status == "failed"
    assert summary.skip_reason
