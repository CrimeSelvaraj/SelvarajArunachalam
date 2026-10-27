"""Article composer — scholarly news narrative from screened sources + evidence.

Prefers LLM composition when OPENAI_API_KEY (or compatible provider) is set.
Otherwise builds a readable heuristic/template article from findings and quotes.
Enforces a claim→source map and refuses unsupported sensational claims.
"""

from __future__ import annotations

import html
import json
import os
import re
import uuid
from typing import Iterable

import httpx

from scholarly_api.models import (
    ArticleClaim,
    ArticleSection,
    ComposedArticle,
    EvidencePackSummary,
    ScreenDecision,
    SourceWork,
)
from scholarly_api.paperqa_adapter import llm_keys_available

_SENSATIONAL = re.compile(
    r"(?i)\b("
    r"miracle|cures? all|breakthrough that will change everything|"
    r"scientists are stunned|completely safe|guaranteed|100% effective|"
    r"revolutionary cure|definitively proves|ends the debate|"
    r"no side effects|overnight|game[- ]changer that will"
    r")\b"
)

_MARKDOWN_BOLD = re.compile(r"\*\*([^*]+)\*\*")
_MARKDOWN_ITALIC = re.compile(r"(?<!\*)\*([^*]+)\*(?!\*)")
_CITE_MARKER = re.compile(r"\[(\d+)\]")


def _cite_index_map(sources: list[SourceWork]) -> list[SourceWork]:
    """Stable citation order: screened-in works first, then software."""
    included = [s for s in sources if s.screen_decision == ScreenDecision.include]
    if not included:
        included = list(sources)
    works = [s for s in included if s.source_type != "software"]
    software = [s for s in included if s.source_type == "software"]
    return [*works, *software]


def _source_label(source: SourceWork) -> str:
    if source.source_type == "software":
        return source.github_full_name or source.title
    return source.title


def _short_label(source: SourceWork, max_len: int = 72) -> str:
    label = _source_label(source)
    if len(label) <= max_len:
        return label
    return label[: max_len - 1].rsplit(" ", 1)[0] + "…"


def _finding(evidence: EvidencePackSummary | None, key: str) -> str | None:
    if not evidence:
        return None
    for f in evidence.findings:
        if f.key == key and f.answer and "Skipped" not in f.answer[:40]:
            # Skip the "PaperQA was skipped" meta answers for narrative use
            if f.has_successful_answer is False and "PaperQA was skipped" in f.answer:
                return None
            if f.has_successful_answer is False and f.answer.startswith("Skipped"):
                return None
            return f.answer.strip()
    return None


def _quotes_for_sources(
    evidence: EvidencePackSummary | None,
    source_ids: Iterable[str],
) -> list:
    if not evidence:
        return []
    wanted = set(source_ids)
    return [q for q in evidence.quotes if q.source_id in wanted]


def _refuse_sensational(text: str) -> str | None:
    m = _SENSATIONAL.search(text)
    if m:
        return m.group(0)
    return None


def _markdown_to_html(md: str) -> str:
    """Minimal Markdown → HTML for article display (no external deps)."""
    lines = md.splitlines()
    out: list[str] = []
    in_ul = False
    in_p = False

    def close_p() -> None:
        nonlocal in_p
        if in_p:
            out.append("</p>")
            in_p = False

    def close_ul() -> None:
        nonlocal in_ul
        if in_ul:
            out.append("</ul>")
            in_ul = False

    def inline(text: str) -> str:
        escaped = html.escape(text)
        escaped = _MARKDOWN_BOLD.sub(r"<strong>\1</strong>", escaped)
        escaped = _MARKDOWN_ITALIC.sub(r"<em>\1</em>", escaped)
        # Citation markers → superscript-ish spans
        escaped = _CITE_MARKER.sub(
            r'<sup class="cite"><a href="#ref-\1">[\1]</a></sup>',
            escaped,
        )
        return escaped

    for raw in lines:
        line = raw.rstrip()
        if not line.strip():
            close_p()
            close_ul()
            continue
        if line.startswith("### "):
            close_p()
            close_ul()
            out.append(f"<h3>{inline(line[4:])}</h3>")
            continue
        if line.startswith("## "):
            close_p()
            close_ul()
            out.append(f"<h2>{inline(line[3:])}</h2>")
            continue
        if line.startswith("# "):
            close_p()
            close_ul()
            out.append(f"<h1>{inline(line[2:])}</h1>")
            continue
        if line.startswith("- ") or line.startswith("* "):
            close_p()
            if not in_ul:
                out.append("<ul>")
                in_ul = True
            out.append(f"<li>{inline(line[2:])}</li>")
            continue
        close_ul()
        if not in_p:
            out.append("<p>")
            in_p = True
        else:
            out.append("<br />")
        out.append(inline(line))

    close_p()
    close_ul()
    return "\n".join(out)


def _build_markdown(
    title: str,
    sections: list[ArticleSection],
    cited: list[SourceWork],
) -> str:
    parts = [f"# {title}", ""]
    for sec in sections:
        if sec.heading:
            parts.append(f"## {sec.heading}")
            parts.append("")
        parts.append(sec.markdown.strip())
        parts.append("")
    if cited:
        parts.append("## Sources")
        parts.append("")
        for i, src in enumerate(cited, start=1):
            label = _source_label(src)
            year = f" ({src.year})" if src.year else ""
            link = (
                src.html_url
                or src.landing_url
                or src.doi
                or src.openalex_id
                or ""
            )
            if link:
                parts.append(f"{i}. [{label}{year}]({link})")
            else:
                parts.append(f"{i}. {label}{year}")
        parts.append("")
    return "\n".join(parts).strip() + "\n"


def _validate_claims(
    claims: list[ArticleClaim],
    known_ids: set[str],
) -> tuple[list[ArticleClaim], list[str]]:
    """Drop or flag claims lacking real source ids; collect refused sensational text."""
    kept: list[ArticleClaim] = []
    refused: list[str] = []
    for claim in claims:
        hit = _refuse_sensational(claim.text)
        if hit and not claim.source_ids:
            refused.append(claim.text)
            continue
        if hit and claim.supported is False:
            refused.append(claim.text)
            continue
        valid_ids = [sid for sid in claim.source_ids if sid in known_ids]
        if not valid_ids:
            # Unsupported — refuse rather than publish
            refused.append(claim.text)
            continue
        if hit:
            # Soften: keep only if grounded, but note refusal of sensational framing
            refused.append(f"Sensational framing refused ({hit}): {claim.text[:120]}")
            # Rewrite claim text to strip the sensational token for safety? Keep grounded.
            # Prefer refusing the sensational sentence entirely when pattern matches strongly.
            if re.search(
                r"(?i)\b(miracle|cures? all|guaranteed|100%|completely safe|overnight)\b",
                claim.text,
            ):
                continue
        kept.append(
            ArticleClaim(
                id=claim.id or f"c-{uuid.uuid4().hex[:8]}",
                text=claim.text.strip(),
                source_ids=valid_ids,
                quote_ids=list(claim.quote_ids or []),
                supported=True,
            )
        )
    return kept, refused


def _heuristic_compose(
    topic: str,
    sources: list[SourceWork],
    evidence: EvidencePackSummary | None,
) -> ComposedArticle:
    cited = _cite_index_map(sources)
    id_to_n = {s.openalex_id: i + 1 for i, s in enumerate(cited)}
    known = set(id_to_n)

    quotes = list(evidence.quotes) if evidence else []
    findings_kf = _finding(evidence, "key_findings")
    findings_cons = _finding(evidence, "consensus")
    findings_cav = _finding(evidence, "caveats")

    claims: list[ArticleClaim] = []
    refused: list[str] = []

    # Lede from top quotes / topic framing
    lede_bits: list[str] = []
    lede_claim_ids: list[str] = []
    used_sources: set[str] = set()

    for q in quotes[:3]:
        n = id_to_n.get(q.source_id)
        if not n:
            continue
        sens = _refuse_sensational(q.quote)
        if sens:
            refused.append(q.quote)
            continue
        cid = f"c-{uuid.uuid4().hex[:8]}"
        marker = f"[{n}]"
        sentence = q.quote.rstrip(".")
        if not sentence.endswith((".", "!", "?")):
            sentence = sentence + "."
        # Attach marker once
        lede_bits.append(f"{sentence} {marker}")
        claims.append(
            ArticleClaim(
                id=cid,
                text=sentence,
                source_ids=[q.source_id],
                quote_ids=[q.id],
                supported=True,
            )
        )
        lede_claim_ids.append(cid)
        used_sources.add(q.source_id)

    if not lede_bits:
        n_papers = sum(1 for s in cited if s.source_type != "software")
        n_soft = sum(1 for s in cited if s.source_type == "software")
        lede_bits.append(
            f"Open research on {topic} points to a growing evidence base "
            f"across {n_papers} screened paper"
            f"{'' if n_papers == 1 else 's'}"
            + (
                f" and {n_soft} software project"
                f"{'' if n_soft == 1 else 's'}"
                if n_soft
                else ""
            )
            + ", drawn from OpenAlex and public GitHub candidates."
        )

    lede_md = " ".join(lede_bits)

    # Body: findings + remaining quotes
    body_paras: list[str] = []
    body_claim_ids: list[str] = []

    if findings_kf:
        sens = _refuse_sensational(findings_kf)
        if sens:
            refused.append(findings_kf)
        else:
            # Attach markers from linked quotes if available
            kf_finding = next(
                (f for f in (evidence.findings if evidence else []) if f.key == "key_findings"),
                None,
            )
            markers: list[str] = []
            src_ids: list[str] = []
            qids: list[str] = []
            if kf_finding and evidence:
                qmap = {q.id: q for q in evidence.quotes}
                for qid in kf_finding.quote_ids:
                    q = qmap.get(qid)
                    if not q:
                        continue
                    n = id_to_n.get(q.source_id)
                    if n:
                        markers.append(f"[{n}]")
                        src_ids.append(q.source_id)
                        qids.append(q.id)
                        used_sources.add(q.source_id)
            if not src_ids and quotes:
                for q in quotes[:4]:
                    n = id_to_n.get(q.source_id)
                    if n and q.source_id not in src_ids:
                        markers.append(f"[{n}]")
                        src_ids.append(q.source_id)
                        qids.append(q.id)
                        used_sources.add(q.source_id)
            if not src_ids and cited:
                # Fall back: cite first few included sources for the finding text
                for s in cited[:3]:
                    src_ids.append(s.openalex_id)
                    markers.append(f"[{id_to_n[s.openalex_id]}]")
                    used_sources.add(s.openalex_id)
            mark_str = "".join(dict.fromkeys(markers))  # unique, order-preserving
            para = findings_kf.rstrip()
            if mark_str and mark_str not in para:
                para = f"{para} {mark_str}"
            cid = f"c-{uuid.uuid4().hex[:8]}"
            if src_ids:
                claims.append(
                    ArticleClaim(
                        id=cid,
                        text=para,
                        source_ids=src_ids,
                        quote_ids=qids,
                        supported=True,
                    )
                )
                body_claim_ids.append(cid)
                body_paras.append(para)
            else:
                refused.append(para)

    # Additional grounded excerpts as body bullets
    extra_lines: list[str] = []
    for q in quotes:
        if q.source_id in used_sources and q.id in {
            c for claim in claims for c in claim.quote_ids
        }:
            continue
        n = id_to_n.get(q.source_id)
        if not n:
            continue
        if _refuse_sensational(q.quote):
            refused.append(q.quote)
            continue
        if len(extra_lines) >= 5:
            break
        sentence = q.quote.rstrip(".")
        line = f"- {sentence}. [{n}]"
        cid = f"c-{uuid.uuid4().hex[:8]}"
        claims.append(
            ArticleClaim(
                id=cid,
                text=sentence,
                source_ids=[q.source_id],
                quote_ids=[q.id],
                supported=True,
            )
        )
        body_claim_ids.append(cid)
        extra_lines.append(line)
        used_sources.add(q.source_id)

    if findings_cons and not _refuse_sensational(findings_cons):
        src_ids = [s.openalex_id for s in cited[:4]]
        markers = "".join(f"[{id_to_n[sid]}]" for sid in src_ids if sid in id_to_n)
        para = findings_cons.rstrip()
        if markers and markers not in para:
            para = f"{para} {markers}"
        cid = f"c-{uuid.uuid4().hex[:8]}"
        claims.append(
            ArticleClaim(
                id=cid,
                text=para,
                source_ids=src_ids,
                quote_ids=[],
                supported=True,
            )
        )
        body_claim_ids.append(cid)
        body_paras.append(para)
        used_sources.update(src_ids)
    elif findings_cons and _refuse_sensational(findings_cons):
        refused.append(findings_cons)

    if extra_lines:
        body_paras.append("Additional evidence excerpts:\n" + "\n".join(extra_lines))

    if not body_paras:
        # Absolute fallback from source titles — still claim-mapped
        lines = []
        for s in cited[:6]:
            n = id_to_n[s.openalex_id]
            snippet = (s.abstract_snippet or s.readme_snippet or "").strip()
            if snippet and not _refuse_sensational(snippet):
                cut = snippet if len(snippet) < 280 else snippet[:279].rsplit(" ", 1)[0] + "…"
                line = f"- {_short_label(s)}: {cut} [{n}]"
                cid = f"c-{uuid.uuid4().hex[:8]}"
                claims.append(
                    ArticleClaim(
                        id=cid,
                        text=cut,
                        source_ids=[s.openalex_id],
                        quote_ids=[],
                        supported=True,
                    )
                )
                body_claim_ids.append(cid)
                lines.append(line)
                used_sources.add(s.openalex_id)
            else:
                line = f"- {_short_label(s)} [{n}]"
                cid = f"c-{uuid.uuid4().hex[:8]}"
                claims.append(
                    ArticleClaim(
                        id=cid,
                        text=_short_label(s),
                        source_ids=[s.openalex_id],
                        quote_ids=[],
                        supported=True,
                    )
                )
                body_claim_ids.append(cid)
                lines.append(line)
                used_sources.add(s.openalex_id)
        body_paras.append(
            "Evidence from screened sources (heuristic compose — no LLM key):\n"
            + "\n".join(lines)
        )

    body_md = "\n\n".join(body_paras)

    # Why it matters
    soft = [s for s in cited if s.source_type == "software"]
    why_bits = [
        f"Readers tracking {topic} can use this pack to see which open papers "
        f"and tools survived relevance screening — and which claims are tied "
        f"to identifiable sources rather than model invention."
    ]
    if soft:
        names = ", ".join(_short_label(s, 40) for s in soft[:3])
        n = id_to_n.get(soft[0].openalex_id)
        mark = f" [{n}]" if n else ""
        why_bits.append(
            f"Public software such as {names} offers reproducible methods "
            f"alongside the literature{mark}."
        )
        if n:
            cid = f"c-{uuid.uuid4().hex[:8]}"
            claims.append(
                ArticleClaim(
                    id=cid,
                    text=why_bits[-1],
                    source_ids=[soft[0].openalex_id],
                    quote_ids=[],
                    supported=True,
                )
            )
    why_md = " ".join(why_bits)

    # Limitations
    lim_bits: list[str] = []
    if findings_cav and not _refuse_sensational(findings_cav):
        lim_bits.append(findings_cav.rstrip())
    lim_bits.append(
        "This article was composed heuristically from the evidence pack "
        "(no LLM compose key). Citation markers are provisional; full CSL/BibTeX "
        "polish arrives in a later phase. OA full text was preferred; closed "
        "works contribute metadata/abstracts only."
    )
    if evidence and evidence.status == "paperqa_skipped":
        lim_bits.append(
            f"PaperQA was skipped ({evidence.skip_reason or 'no LLM key'}); "
            "quotes are excerpt-level rather than RAG-grounded answers."
        )
    lim_md = " ".join(lim_bits)

    claims, more_refused = _validate_claims(claims, known)
    refused.extend(more_refused)

    sections = [
        ArticleSection(
            key="lede",
            heading=None,
            markdown=lede_md,
            claim_ids=lede_claim_ids,
        ),
        ArticleSection(
            key="body",
            heading="What the evidence shows",
            markdown=body_md,
            claim_ids=body_claim_ids,
        ),
        ArticleSection(
            key="why_it_matters",
            heading="Why it matters",
            markdown=why_md,
            claim_ids=[],
        ),
        ArticleSection(
            key="limitations",
            heading="Limitations",
            markdown=lim_md,
            claim_ids=[],
        ),
    ]

    title = f"{topic}: what open research shows"
    markdown = _build_markdown(title, sections, cited)
    # Display HTML omits the Sources appendix — UI renders citation markers separately.
    display_md = _build_markdown(title, sections, cited=[])
    article_html = _markdown_to_html(display_md)

    cited_ids = sorted(used_sources) or [s.openalex_id for s in cited]
    skip = (
        "OPENAI_API_KEY (or compatible compose key) not set — "
        "used heuristic template from evidence pack / quotes."
    )

    return ComposedArticle(
        title=title,
        status="heuristic",
        method="heuristic_template",
        markdown=markdown,
        html=article_html,
        sections=sections,
        claims=claims,
        cited_source_ids=cited_ids,
        skip_reason=skip,
        refused_claims=refused[:20],
    )


async def _llm_compose(
    topic: str,
    sources: list[SourceWork],
    evidence: EvidencePackSummary | None,
) -> ComposedArticle | None:
    """OpenAI-compatible JSON compose. Returns None on any failure."""
    api_key = (
        os.getenv("OPENAI_API_KEY", "").strip()
        or os.getenv("LITELLM_API_KEY", "").strip()
    )
    if not api_key:
        return None

    base = (
        os.getenv("OPENAI_BASE_URL", "").strip()
        or os.getenv("LITELLM_BASE_URL", "").strip()
        or "https://api.openai.com/v1"
    ).rstrip("/")
    model = os.getenv("COMPOSE_LLM_MODEL", "").strip() or os.getenv(
        "SCREENING_LLM_MODEL", ""
    ).strip() or "gpt-4o-mini"

    cited = _cite_index_map(sources)
    catalog = []
    for i, s in enumerate(cited, start=1):
        catalog.append(
            {
                "n": i,
                "source_id": s.openalex_id,
                "type": s.source_type,
                "title": _short_label(s, 120),
                "year": s.year,
                "snippet": (
                    (s.abstract_snippet or s.readme_snippet or "")[:280]
                ),
            }
        )

    quote_payload = []
    if evidence:
        for q in evidence.quotes[:16]:
            quote_payload.append(
                {
                    "quote_id": q.id,
                    "source_id": q.source_id,
                    "n": next(
                        (c["n"] for c in catalog if c["source_id"] == q.source_id),
                        None,
                    ),
                    "text": q.quote[:400],
                    "prompt_key": q.prompt_key,
                }
            )

    findings_payload = []
    if evidence:
        for f in evidence.findings:
            findings_payload.append(
                {
                    "key": f.key,
                    "answer": f.answer[:800],
                    "quote_ids": f.quote_ids,
                }
            )

    system = (
        "You write scholarly news articles grounded ONLY in the provided sources "
        "and evidence quotes. Structure: lede (1 short paragraph), body "
        "(2–4 paragraphs under heading 'What the evidence shows'), "
        "'Why it matters', and 'Limitations'. "
        "Every factual claim MUST list source_ids from the catalog. "
        "Inline citation markers must use [n] matching catalog n. "
        "Refuse sensational or unsupported claims (miracle cures, guaranteed "
        "outcomes, 'scientists stunned', etc.) — put them in refused_claims "
        "instead of the article. "
        "Return JSON with keys: title, sections "
        "[{key, heading, markdown, claims:[{text, source_ids, quote_ids}]}], "
        "refused_claims:[string]. "
        "Section keys: lede | body | why_it_matters | limitations. "
        "lede heading may be null. Do not invent DOIs, results, or sources."
    )

    user = {
        "topic": topic,
        "sources": catalog,
        "findings": findings_payload,
        "quotes": quote_payload,
        "evidence_status": evidence.status if evidence else None,
        "evidence_method": evidence.method if evidence else None,
    }

    payload = {
        "model": model,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(user)},
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(
                f"{base}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            parsed = json.loads(content)
    except Exception:  # noqa: BLE001
        return None

    known = {s.openalex_id for s in cited}
    id_to_n = {s.openalex_id: i + 1 for i, s in enumerate(cited)}

    title = str(parsed.get("title") or f"{topic}: what open research shows").strip()
    refused = [str(x) for x in (parsed.get("refused_claims") or []) if str(x).strip()]

    sections: list[ArticleSection] = []
    claims: list[ArticleClaim] = []
    used_sources: set[str] = set()

    raw_sections = parsed.get("sections") or []
    if not isinstance(raw_sections, list) or not raw_sections:
        return None

    for raw in raw_sections:
        if not isinstance(raw, dict):
            continue
        key = str(raw.get("key") or "body").strip()
        heading = raw.get("heading")
        heading = str(heading).strip() if heading else None
        md = str(raw.get("markdown") or "").strip()
        if not md:
            continue
        sens = _refuse_sensational(md)
        if sens and key != "limitations":
            refused.append(md[:200])
            # Still allow if we can strip — but prefer dropping sensational body
            if re.search(
                r"(?i)\b(miracle|cures? all|guaranteed|100%|completely safe)\b",
                md,
            ):
                continue

        sec_claim_ids: list[str] = []
        for craw in raw.get("claims") or []:
            if not isinstance(craw, dict):
                continue
            text = str(craw.get("text") or "").strip()
            if not text:
                continue
            sids = [
                str(x)
                for x in (craw.get("source_ids") or [])
                if str(x) in known
            ]
            qids = [str(x) for x in (craw.get("quote_ids") or [])]
            if not sids:
                refused.append(text)
                continue
            if _refuse_sensational(text) and re.search(
                r"(?i)\b(miracle|cures? all|guaranteed|100%|completely safe)\b",
                text,
            ):
                refused.append(text)
                continue
            cid = f"c-{uuid.uuid4().hex[:8]}"
            claims.append(
                ArticleClaim(
                    id=cid,
                    text=text,
                    source_ids=sids,
                    quote_ids=qids,
                    supported=True,
                )
            )
            sec_claim_ids.append(cid)
            used_sources.update(sids)
            # Ensure markers present for cited sources
            for sid in sids:
                n = id_to_n.get(sid)
                if n and f"[{n}]" not in md:
                    md = f"{md} [{n}]"

        sections.append(
            ArticleSection(
                key=key,
                heading=heading,
                markdown=md,
                claim_ids=sec_claim_ids,
            )
        )

    if not sections:
        return None

    # Ensure required section keys exist (fill gaps lightly)
    have = {s.key for s in sections}
    if "limitations" not in have:
        sections.append(
            ArticleSection(
                key="limitations",
                heading="Limitations",
                markdown=(
                    "Evidence is limited to screened open sources in this job pack; "
                    "closed or unscanned literature may change the picture."
                ),
                claim_ids=[],
            )
        )
    if "why_it_matters" not in have:
        sections.append(
            ArticleSection(
                key="why_it_matters",
                heading="Why it matters",
                markdown=(
                    f"Grounded reporting on {topic} helps separate replicated "
                    "findings from speculation."
                ),
                claim_ids=[],
            )
        )

    claims, more_refused = _validate_claims(claims, known)
    refused.extend(more_refused)

    # Order sections: lede, body, why, limitations, extras
    order = {"lede": 0, "body": 1, "why_it_matters": 2, "limitations": 3}
    sections.sort(key=lambda s: order.get(s.key, 9))

    markdown = _build_markdown(title, sections, cited)
    display_md = _build_markdown(title, sections, cited=[])
    article_html = _markdown_to_html(display_md)

    return ComposedArticle(
        title=title,
        status="ready",
        method=f"llm:{model}",
        markdown=markdown,
        html=article_html,
        sections=sections,
        claims=claims,
        cited_source_ids=sorted(used_sources) or [s.openalex_id for s in cited],
        skip_reason=None,
        refused_claims=refused[:20],
    )


async def compose_article(
    topic: str,
    sources: list[SourceWork],
    evidence: EvidencePackSummary | None,
) -> ComposedArticle:
    """Compose a scholarly news article; degrade to heuristic when no LLM key."""
    included = [s for s in sources if s.screen_decision == ScreenDecision.include]
    pool = included or list(sources)

    if not pool:
        title = f"{topic}: insufficient sources"
        md = (
            f"# {title}\n\n"
            "No screened sources were available to compose an article. "
            "Re-run discovery with a broader topic or enable GitHub software search.\n"
        )
        return ComposedArticle(
            title=title,
            status="failed",
            method="stubbed",
            markdown=md,
            html=_markdown_to_html(md),
            sections=[
                ArticleSection(
                    key="lede",
                    heading=None,
                    markdown="Insufficient screened sources for composition.",
                    claim_ids=[],
                )
            ],
            claims=[],
            cited_source_ids=[],
            skip_reason="No screened-in sources",
            refused_claims=[],
        )

    if llm_keys_available():
        llm_article = await _llm_compose(topic, pool, evidence)
        if llm_article is not None:
            return llm_article

    return _heuristic_compose(topic, pool, evidence)
