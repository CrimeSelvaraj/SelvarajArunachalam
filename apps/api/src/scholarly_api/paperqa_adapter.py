"""Thin PaperQA library adapter — index an evidence pack, answer structured prompts.

Install via `pip install paper-qa` / uv; do not fork or vendor the PaperQA repo.
Gracefully degrades when OPENAI_API_KEY (or compatible LLM keys) are missing.
"""

from __future__ import annotations

import os
import re
import uuid
from typing import Iterable

from scholarly_api.evidence_pack import EvidencePackResult, PackFile
from scholarly_api.models import EvidenceFinding, EvidencePackSummary, EvidenceQuote

STRUCTURED_PROMPTS: list[tuple[str, str]] = [
    (
        "key_findings",
        (
            "From the provided sources only, list the key findings most relevant to: "
            "{topic}. Use short evidence-backed statements. If evidence is thin, say so."
        ),
    ),
    (
        "consensus",
        (
            "Where do these sources agree about: {topic}? Summarize any emerging "
            "consensus. Cite only what the documents support."
        ),
    ),
    (
        "caveats",
        (
            "What caveats, limitations, conflicts, or open questions appear in these "
            "sources regarding: {topic}? Prefer uncertainty over speculation."
        ),
    ),
]

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


def llm_keys_available() -> bool:
    """True when a PaperQA-compatible LLM key appears to be configured."""
    for name in (
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "GEMINI_API_KEY",
        "GOOGLE_API_KEY",
        "AZURE_API_KEY",
        "OPENROUTER_API_KEY",
    ):
        if os.getenv(name, "").strip():
            return True
    return False


_HTML_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
_MARKUP_NOISE = re.compile(
    r"(?i)^(https?://|www\.|license:|url:|badges?|\[!\[|<!DOCTYPE|<html)"
)


def _excerpt_sentences(text: str, *, max_sentences: int = 2, max_chars: int = 420) -> str:
    cleaned = _HTML_COMMENT.sub(" ", text)
    # Prefer abstract body when our pack header is present
    if "Abstract:" in cleaned:
        cleaned = cleaned.split("Abstract:", 1)[-1]
    # Drop noisy README / markup lines before sentence split
    kept: list[str] = []
    for ln in cleaned.splitlines():
        strip = ln.strip()
        if not strip or strip.startswith("#"):
            continue
        if _MARKUP_NOISE.match(strip):
            continue
        if strip.startswith("```") or strip.startswith("---"):
            continue
        kept.append(strip)
    cleaned = re.sub(r"\s+", " ", " ".join(kept)).strip()
    sentences = [
        s.strip()
        for s in _SENTENCE_SPLIT.split(cleaned)
        if s.strip() and not _MARKUP_NOISE.match(s.strip())
    ]
    # Prefer sentences that look like prose
    prose = [s for s in sentences if len(s) >= 40 and " " in s]
    use = prose or sentences
    if not use:
        return cleaned[:max_chars]
    chunk = " ".join(use[:max_sentences])
    if len(chunk) > max_chars:
        cut = chunk[: max_chars - 1].rsplit(" ", 1)[0]
        return f"{cut}…"
    return chunk


def _heuristic_from_pack(
    topic: str, pack: EvidencePackResult
) -> EvidencePackSummary:
    """Build quote-level excerpts without calling PaperQA."""
    quotes: list[EvidenceQuote] = []
    by_source: dict[str, list[str]] = {}

    for pf in pack.files:
        if pf.kind == "pdf":
            # Without an LLM/PDF parse we only note the PDF is on disk.
            continue
        try:
            text = pf.absolute_path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        # Prefer body after Abstract: for abstracts
        body = text
        if pf.kind == "abstract" and "Abstract:" in text:
            body = text.split("Abstract:", 1)[-1]
        elif pf.kind == "readme":
            # Drop YAML-ish / header lines we wrote
            body = "\n".join(
                ln
                for ln in text.splitlines()
                if not ln.startswith("URL:")
                and not ln.startswith("License:")
                and not ln.startswith("# ")
            )
        excerpt = _excerpt_sentences(body)
        if not excerpt or len(excerpt) < 40:
            continue
        qid = f"q-{uuid.uuid4().hex[:10]}"
        quotes.append(
            EvidenceQuote(
                id=qid,
                source_id=pf.source_id,
                quote=excerpt,
                summary=None,
                prompt_key="excerpt",
                score=None,
                docname=pf.relative_path,
            )
        )
        by_source.setdefault(pf.source_id, []).append(qid)

    quote_ids = [q.id for q in quotes[:12]]
    skip = (
        "OPENAI_API_KEY (or compatible PaperQA LLM key) not set — "
        "indexed abstracts/READMEs only; PaperQA step skipped."
    )
    findings = [
        EvidenceFinding(
            key="key_findings",
            question=STRUCTURED_PROMPTS[0][1].format(topic=topic),
            answer=(
                "PaperQA was skipped (no LLM API key). "
                f"Collected {len(quotes)} heuristic excerpt"
                f"{'' if len(quotes) == 1 else 's'} from "
                f"{pack.source_count} screened-in source"
                f"{'' if pack.source_count == 1 else 's'} "
                f"({pack.pdf_count} OA PDF"
                f"{'' if pack.pdf_count == 1 else 's'}, "
                f"{pack.text_count} text file"
                f"{'' if pack.text_count == 1 else 's'}). "
                "Set OPENAI_API_KEY to enable grounded PaperQA findings."
            ),
            has_successful_answer=False,
            quote_ids=quote_ids,
        ),
        EvidenceFinding(
            key="consensus",
            question=STRUCTURED_PROMPTS[1][1].format(topic=topic),
            answer="Skipped — awaiting PaperQA with an LLM key.",
            has_successful_answer=False,
            quote_ids=[],
        ),
        EvidenceFinding(
            key="caveats",
            question=STRUCTURED_PROMPTS[2][1].format(topic=topic),
            answer=(
                "Skipped — evidence pack is available on disk, but structured "
                "caveat synthesis requires PaperQA."
            ),
            has_successful_answer=False,
            quote_ids=[],
        ),
    ]

    return EvidencePackSummary(
        status="paperqa_skipped",
        method="heuristic_excerpts",
        directory=str(pack.directory),
        file_count=len(pack.files),
        pdf_count=pack.pdf_count,
        text_count=pack.text_count,
        source_count=pack.source_count,
        skip_reason=skip,
        findings=findings,
        quotes=quotes,
    )


def _source_id_for_doc(
    dockey: str | None, docname: str | None, files: Iterable[PackFile]
) -> str | None:
    files_list = list(files)
    if dockey:
        for pf in files_list:
            if pf.source_id == dockey or pf.relative_path == dockey:
                return pf.source_id
            # We pass dockey=source_id when adding
            stem = pf.relative_path.rsplit(".", 1)[0]
            if dockey in (stem, pf.relative_path, pf.source_id):
                return pf.source_id
    if docname:
        for pf in files_list:
            if docname in (pf.relative_path, pf.title) or docname in pf.relative_path:
                return pf.source_id
    return None


async def _run_paperqa(
    topic: str, pack: EvidencePackResult
) -> EvidencePackSummary:
    # Local import so missing optional runtime extras fail inside the adapter.
    from paperqa import Docs, Settings

    llm = os.getenv("PAPERQA_LLM", "").strip() or None
    summary_llm = os.getenv("PAPERQA_SUMMARY_LLM", "").strip() or llm
    embedding = os.getenv("PAPERQA_EMBEDDING", "").strip() or None

    settings_kwargs: dict = {"temperature": 0.1}
    if llm:
        settings_kwargs["llm"] = llm
    if summary_llm:
        settings_kwargs["summary_llm"] = summary_llm
    if embedding:
        settings_kwargs["embedding"] = embedding

    settings = Settings(**settings_kwargs)
    docs = Docs()

    added = 0
    for pf in pack.files:
        try:
            await docs.aadd(
                str(pf.absolute_path),
                citation=pf.citation,
                docname=pf.relative_path,
                dockey=pf.source_id,
                title=pf.title,
                doi=pf.doi,
                authors=pf.authors or None,
                settings=settings,
            )
            added += 1
        except Exception:  # noqa: BLE001 — continue indexing other files
            continue

    if added == 0:
        summary = _heuristic_from_pack(topic, pack)
        summary.status = "failed"
        summary.skip_reason = "PaperQA could not index any evidence files"
        summary.method = "heuristic_excerpts"
        return summary

    quotes: list[EvidenceQuote] = []
    findings: list[EvidenceFinding] = []

    for key, template in STRUCTURED_PROMPTS:
        question = template.format(topic=topic)
        try:
            session = await docs.aquery(question, settings=settings)
        except Exception as exc:  # noqa: BLE001
            findings.append(
                EvidenceFinding(
                    key=key,
                    question=question,
                    answer=f"PaperQA query failed: {exc}",
                    has_successful_answer=False,
                    quote_ids=[],
                )
            )
            continue

        quote_ids: list[str] = []
        for ctx in session.contexts or []:
            text_obj = ctx.text
            raw_quote = (getattr(text_obj, "text", None) or "") if text_obj else ""
            raw_quote = re.sub(r"\s+", " ", raw_quote).strip()
            if len(raw_quote) > 600:
                raw_quote = raw_quote[:599].rsplit(" ", 1)[0] + "…"
            summary_txt = (ctx.context or "").strip() or None
            doc = getattr(text_obj, "doc", None) if text_obj else None
            dockey = getattr(doc, "dockey", None) if doc else None
            docname = getattr(doc, "docname", None) if doc else None
            source_id = _source_id_for_doc(dockey, docname, pack.files)
            if not source_id:
                # Fall back: first file
                source_id = pack.files[0].source_id if pack.files else "unknown"
            if not raw_quote and not summary_txt:
                continue
            qid = f"q-{uuid.uuid4().hex[:10]}"
            quotes.append(
                EvidenceQuote(
                    id=qid,
                    source_id=source_id,
                    quote=raw_quote or (summary_txt or ""),
                    summary=summary_txt,
                    prompt_key=key,
                    score=float(ctx.score) if ctx.score is not None else None,
                    docname=docname,
                )
            )
            quote_ids.append(qid)

        findings.append(
            EvidenceFinding(
                key=key,
                question=question,
                answer=(session.answer or session.formatted_answer or "").strip()
                or "(empty answer)",
                has_successful_answer=bool(session.has_successful_answer),
                quote_ids=quote_ids,
            )
        )

    return EvidencePackSummary(
        status="ready",
        method="paperqa",
        directory=str(pack.directory),
        file_count=len(pack.files),
        pdf_count=pack.pdf_count,
        text_count=pack.text_count,
        source_count=pack.source_count,
        skip_reason=None,
        findings=findings,
        quotes=quotes,
    )


async def analyze_evidence_pack(
    topic: str, pack: EvidencePackResult
) -> EvidencePackSummary:
    """Index pack + answer structured prompts, or degrade to heuristic excerpts."""
    if not pack.files:
        return EvidencePackSummary(
            status="failed",
            method="stubbed",
            directory=str(pack.directory),
            file_count=0,
            pdf_count=0,
            text_count=0,
            source_count=pack.source_count,
            skip_reason="No evidence files collected for screened-in sources",
            findings=[],
            quotes=[],
        )

    if not llm_keys_available():
        return _heuristic_from_pack(topic, pack)

    try:
        return await _run_paperqa(topic, pack)
    except Exception as exc:  # noqa: BLE001
        summary = _heuristic_from_pack(topic, pack)
        summary.status = "paperqa_skipped"
        summary.skip_reason = f"PaperQA failed ({exc}); fell back to heuristic excerpts"
        return summary
