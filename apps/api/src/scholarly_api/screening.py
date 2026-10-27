"""ASReview-inspired screening — rank, dedupe, include/exclude with rationales.

Does not embed ASReview LAB. Heuristic ranker by default; optional light LLM
re-rank when OPENAI_API_KEY (or compatible) is set, with graceful fallback.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass

import httpx

from scholarly_api.models import (
    JobOptions,
    ScreenDecision,
    ScreeningSummary,
    SourceWork,
)

_STOPWORDS = frozenset(
    """
    a an the and or of for to in on with by from as at into over under
    about into through during before after above below between out off
    is are was were be been being this that these those it its their
    our your we you they he she them using use used based study studies
    research paper papers review toward towards via vs versus new
    """.split()
)

_TITLE_NOISE = re.compile(r"[^\w\s]+", re.UNICODE)
_DOI_PREFIX = re.compile(r"^https?://(dx\.)?doi\.org/", re.I)


def default_screen_max(depth: str) -> int:
    """Sensible deep-read caps: quick brief vs deeper pack."""
    return 18 if (depth or "").lower() == "deep" else 12


def resolve_screen_max(options: JobOptions) -> int:
    if options.screen_max is not None:
        return max(4, min(40, int(options.screen_max)))
    return default_screen_max(options.depth)


def _tokens(text: str | None) -> set[str]:
    if not text:
        return set()
    words = _TITLE_NOISE.sub(" ", text.lower()).split()
    return {w for w in words if len(w) > 2 and w not in _STOPWORDS}


def normalize_doi(doi: str | None) -> str | None:
    if not doi:
        return None
    d = doi.strip().lower()
    d = _DOI_PREFIX.sub("", d)
    d = d.removeprefix("doi:")
    return d.strip() or None


def normalize_title(title: str | None) -> str:
    if not title:
        return ""
    t = _TITLE_NOISE.sub(" ", title.lower())
    t = re.sub(r"\s+", " ", t).strip()
    return t


def normalize_url(url: str | None) -> str | None:
    if not url:
        return None
    u = url.strip().lower()
    u = re.sub(r"^https?://", "", u)
    u = u.removeprefix("www.")
    u = u.rstrip("/")
    return u or None


def source_key(source: SourceWork) -> str:
    if source.source_type == "software" and source.github_full_name:
        return f"gh:{source.github_full_name.lower()}"
    return source.openalex_id or f"title:{normalize_title(source.title)}"


def _overlap_score(topic_tokens: set[str], text_tokens: set[str]) -> float:
    if not topic_tokens or not text_tokens:
        return 0.0
    hit = len(topic_tokens & text_tokens)
    return hit / len(topic_tokens)


def heuristic_relevance(topic: str, source: SourceWork) -> tuple[float, list[str]]:
    """Return (score 0–1, reason fragments) for a candidate."""
    topic_tokens = _tokens(topic)
    title_tokens = _tokens(source.title)
    body = source.abstract_snippet or source.readme_snippet or ""
    body_tokens = _tokens(body)

    title_hit = _overlap_score(topic_tokens, title_tokens)
    body_hit = _overlap_score(topic_tokens, body_tokens)

    # Weighted blend — title matters more for screening.
    score = 0.55 * title_hit + 0.30 * body_hit
    reasons: list[str] = []

    if title_hit >= 0.5:
        reasons.append(f"strong title match ({title_hit:.0%})")
    elif title_hit > 0:
        reasons.append(f"partial title match ({title_hit:.0%})")
    else:
        reasons.append("weak title match")

    if body_hit >= 0.35:
        reasons.append("abstract/README supports topic")

    if source.source_type == "work":
        cites = source.cited_by_count or 0
        if cites >= 200:
            score += 0.12
            reasons.append(f"highly cited ({cites})")
        elif cites >= 50:
            score += 0.08
            reasons.append(f"moderately cited ({cites})")
        elif cites >= 10:
            score += 0.04
        if source.is_oa:
            score += 0.05
            reasons.append("open access")
        if source.pdf_url:
            score += 0.03
            reasons.append("PDF available")
        if source.year and source.year >= 2020:
            score += 0.03
    else:
        stars = source.stars or 0
        if stars >= 5000:
            score += 0.12
            reasons.append(f"popular repo (★{stars:,})")
        elif stars >= 500:
            score += 0.08
            reasons.append(f"active interest (★{stars:,})")
        elif stars >= 50:
            score += 0.04
        if source.citation_cff:
            score += 0.06
            reasons.append("has CITATION.cff")
        if source.license_spdx:
            score += 0.02

    # Soft floor so empty-overlap items stay rankable but low.
    score = max(0.02, min(1.0, score))
    return score, reasons


@dataclass
class _Scored:
    source: SourceWork
    score: float
    reason_bits: list[str]
    key: str


def dedupe_candidates(scored: list[_Scored]) -> tuple[list[_Scored], list[_Scored]]:
    """Keep highest-scoring unique item; mark DOI / title / URL duplicates."""
    keep: list[_Scored] = []
    dups: list[_Scored] = []

    seen_doi: dict[str, str] = {}
    seen_title: dict[str, str] = {}
    seen_url: dict[str, str] = {}

    # Highest score first so canonical copy wins.
    ordered = sorted(scored, key=lambda s: s.score, reverse=True)

    for item in ordered:
        src = item.source
        doi = normalize_doi(src.doi)
        title = normalize_title(src.title)
        url = normalize_url(
            src.html_url or src.landing_url or src.oa_url or src.pdf_url
        )
        # Also treat github full name as URL identity for software.
        if src.github_full_name:
            url = normalize_url(f"github.com/{src.github_full_name}") or url

        dup_of: str | None = None
        if doi and doi in seen_doi:
            dup_of = seen_doi[doi]
            why = f"duplicate DOI of {dup_of}"
        elif title and len(title) >= 12 and title in seen_title:
            dup_of = seen_title[title]
            why = f"duplicate title of {dup_of}"
        elif url and url in seen_url:
            dup_of = seen_url[url]
            why = f"duplicate URL of {dup_of}"

        if dup_of:
            src.screen_decision = ScreenDecision.duplicate
            src.relevance_score = round(item.score, 4)
            src.screen_rationale = why
            src.duplicate_of = dup_of
            dups.append(item)
            continue

        if doi:
            seen_doi[doi] = item.key
        if title and len(title) >= 12:
            seen_title[title] = item.key
        if url:
            seen_url[url] = item.key
        keep.append(item)

    return keep, dups


async def _llm_rerank(
    topic: str, items: list[_Scored]
) -> tuple[list[_Scored], str] | None:
    """Optional OpenAI-compatible re-rank. Returns None on any failure."""
    api_key = (
        os.getenv("OPENAI_API_KEY", "").strip()
        or os.getenv("LITELLM_API_KEY", "").strip()
    )
    if not api_key or not items:
        return None

    base = (
        os.getenv("OPENAI_BASE_URL", "").strip()
        or os.getenv("LITELLM_BASE_URL", "").strip()
        or "https://api.openai.com/v1"
    ).rstrip("/")
    model = os.getenv("SCREENING_LLM_MODEL", "").strip() or "gpt-4o-mini"

    catalog = []
    for i, item in enumerate(items):
        s = item.source
        catalog.append(
            {
                "i": i,
                "type": s.source_type,
                "title": s.title[:180],
                "snippet": (s.abstract_snippet or s.readme_snippet or "")[:220],
                "heuristic": round(item.score, 3),
            }
        )

    payload = {
        "model": model,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": (
                    "You screen scholarly and software candidates for a news "
                    "article. Return JSON: {\"scores\":[{\"i\":0,\"score\":0.0,"
                    "\"why\":\"short reason\"},...]}. Scores are 0–1 relevance "
                    "to the topic. Keep reasons under 12 words."
                ),
            },
            {
                "role": "user",
                "content": json.dumps({"topic": topic, "candidates": catalog}),
            },
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
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
            scores = parsed.get("scores") or parsed.get("rankings") or []
            by_i: dict[int, tuple[float, str]] = {}
            for row in scores:
                try:
                    idx = int(row["i"])
                    sc = float(row["score"])
                    why = str(row.get("why") or row.get("reason") or "").strip()
                    by_i[idx] = (max(0.0, min(1.0, sc)), why)
                except (KeyError, TypeError, ValueError):
                    continue
            if not by_i:
                return None
            out: list[_Scored] = []
            for idx, item in enumerate(items):
                if idx in by_i:
                    sc, why = by_i[idx]
                    # Blend lightly with heuristic so LLM can't erase OA/cite signal.
                    blended = 0.7 * sc + 0.3 * item.score
                    bits = [why] if why else list(item.reason_bits)
                    out.append(
                        _Scored(
                            source=item.source,
                            score=blended,
                            reason_bits=bits,
                            key=item.key,
                        )
                    )
                else:
                    out.append(item)
            return out, model
    except Exception:  # noqa: BLE001 — degrade to heuristics
        return None


async def screen_sources(
    topic: str,
    sources: list[SourceWork],
    options: JobOptions,
) -> tuple[list[SourceWork], ScreeningSummary]:
    """Rank, dedupe, and cap sources for deep read. Mutates source screen fields."""
    max_include = resolve_screen_max(options)
    method = "heuristic"

    scored: list[_Scored] = []
    for s in sources:
        sc, bits = heuristic_relevance(topic, s)
        scored.append(
            _Scored(source=s, score=sc, reason_bits=bits, key=source_key(s))
        )

    llm = await _llm_rerank(topic, scored)
    if llm is not None:
        scored, model_name = llm
        method = f"llm:{model_name}"

    unique, dups = dedupe_candidates(scored)
    unique.sort(key=lambda x: x.score, reverse=True)

    # Rank primarily by score. Softly ensure one competitive software source
    # when GitHub candidates exist but none landed in the top cap.
    included = unique[:max_include]
    included_keys = {x.key for x in included}
    has_software = any(x.source.source_type == "software" for x in included)
    software_pool = [
        u
        for u in unique
        if u.source.source_type == "software" and u.key not in included_keys
    ]
    if not has_software and software_pool and included:
        best_soft = software_pool[0]
        # Only swap if the repo is at least moderately on-topic.
        if best_soft.score >= 0.2:
            # Replace the lowest-scoring included work (prefer swapping a work).
            swap_idx = None
            for i in range(len(included) - 1, -1, -1):
                if included[i].source.source_type != "software":
                    swap_idx = i
                    break
            if swap_idx is None:
                swap_idx = len(included) - 1
            included[swap_idx] = best_soft
            included.sort(key=lambda x: x.score, reverse=True)

    included_keys = {x.key for x in included}
    excluded = [u for u in unique if u.key not in included_keys]

    # Apply decisions onto SourceWork objects (preserve original order later).
    decision_map: dict[str, SourceWork] = {}

    for rank, item in enumerate(included, start=1):
        src = item.source
        src.relevance_score = round(item.score, 4)
        src.screen_decision = ScreenDecision.include
        src.screen_rationale = (
            f"Included for deep read (rank {rank}/{len(included)}). "
            + "; ".join(item.reason_bits[:3])
        )
        src.duplicate_of = None
        decision_map[item.key] = src

    for item in excluded:
        src = item.source
        src.relevance_score = round(item.score, 4)
        src.screen_decision = ScreenDecision.exclude
        src.screen_rationale = (
            f"Below deep-read cap of {max_include} "
            f"(score {item.score:.2f}). " + "; ".join(item.reason_bits[:2])
        )
        src.duplicate_of = None
        decision_map[item.key] = src

    for item in dups:
        # Already stamped in dedupe_candidates
        decision_map[item.key] = item.source

    # Preserve discovery order in returned list, with screen fields set.
    out: list[SourceWork] = []
    for s in sources:
        key = source_key(s)
        out.append(decision_map.get(key, s))

    summary = ScreeningSummary(
        method=method,
        max_include=max_include,
        included_count=sum(
            1 for s in out if s.screen_decision == ScreenDecision.include
        ),
        excluded_count=sum(
            1 for s in out if s.screen_decision == ScreenDecision.exclude
        ),
        duplicate_count=sum(
            1 for s in out if s.screen_decision == ScreenDecision.duplicate
        ),
        candidate_count=len(sources),
    )
    return out, summary
