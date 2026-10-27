"""Thin OpenAlex HTTP client — do not vendor openalex-help."""

from __future__ import annotations

import os
import re
from typing import Any

import httpx

from scholarly_api.models import SourceWork

OPENALEX_BASE = "https://api.openalex.org"
DEFAULT_MAILTO = "proofpress-dev@example.com"
USER_AGENT = "ProofPress/0.2 (+https://github.com/CrimeSelvaraj/SelvarajArunachalam)"

# Fields we request — keep payload small and stable for our SourceWork mapping.
WORK_SELECT = ",".join(
    [
        "id",
        "doi",
        "title",
        "display_name",
        "publication_year",
        "authorships",
        "abstract_inverted_index",
        "open_access",
        "primary_location",
        "best_oa_location",
        "cited_by_count",
    ]
)


def _mailto() -> str:
    return (
        os.getenv("OPENALEX_MAILTO")
        or os.getenv("UNPAYWALL_EMAIL")
        or DEFAULT_MAILTO
    ).strip()


def _api_key() -> str | None:
    key = os.getenv("OPENALEX_API_KEY", "").strip()
    return key or None


def _headers() -> dict[str, str]:
    return {
        "User-Agent": f"{USER_AGENT} (mailto:{_mailto()})",
        "Accept": "application/json",
    }


def reconstruct_abstract(inverted: dict[str, list[int]] | None) -> str | None:
    """Rebuild abstract text from OpenAlex inverted index."""
    if not inverted:
        return None
    positions: list[tuple[int, str]] = []
    for word, idxs in inverted.items():
        for i in idxs:
            positions.append((i, word))
    if not positions:
        return None
    positions.sort(key=lambda p: p[0])
    text = " ".join(word for _, word in positions)
    # Soft cleanup for doubled spaces around punctuation-ish tokens
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def abstract_snippet(text: str | None, limit: int = 280) -> str | None:
    if not text:
        return None
    if len(text) <= limit:
        return text
    cut = text[: limit - 1].rsplit(" ", 1)[0]
    return f"{cut}…"


def _author_names(authorships: list[dict[str, Any]] | None, limit: int = 8) -> list[str]:
    names: list[str] = []
    for item in authorships or []:
        author = item.get("author") or {}
        name = author.get("display_name") or item.get("raw_author_name")
        if name:
            names.append(str(name))
        if len(names) >= limit:
            break
    return names


def _pdf_url(work: dict[str, Any]) -> str | None:
    for loc_key in ("best_oa_location", "primary_location"):
        loc = work.get(loc_key) or {}
        pdf = loc.get("pdf_url")
        if pdf:
            return str(pdf)
    oa = work.get("open_access") or {}
    if oa.get("oa_url"):
        return str(oa["oa_url"])
    return None


def _landing_url(work: dict[str, Any]) -> str | None:
    loc = work.get("primary_location") or {}
    if loc.get("landing_page_url"):
        return str(loc["landing_page_url"])
    if work.get("doi"):
        return str(work["doi"])
    if work.get("id"):
        return str(work["id"])
    return None


def map_work(raw: dict[str, Any]) -> SourceWork:
    oa = raw.get("open_access") or {}
    abstract = reconstruct_abstract(raw.get("abstract_inverted_index"))
    openalex_id = str(raw.get("id") or "")
    doi = raw.get("doi")
    title = raw.get("title") or raw.get("display_name") or "Untitled work"
    return SourceWork(
        openalex_id=openalex_id,
        doi=str(doi) if doi else None,
        title=str(title),
        authors=_author_names(raw.get("authorships")),
        year=raw.get("publication_year"),
        abstract_snippet=abstract_snippet(abstract),
        is_oa=bool(oa.get("is_oa")),
        oa_status=oa.get("oa_status"),
        oa_url=str(oa["oa_url"]) if oa.get("oa_url") else None,
        pdf_url=_pdf_url(raw),
        landing_url=_landing_url(raw),
        cited_by_count=raw.get("cited_by_count"),
    )


def _per_page_for_depth(depth: str) -> int:
    return 12 if depth == "deep" else 8


async def search_works(topic: str, *, depth: str = "quick") -> list[SourceWork]:
    """Search OpenAlex works by topic; returns mapped SourceWork list."""
    query = topic.strip()
    if not query:
        return []

    params: dict[str, Any] = {
        "search": query,
        "per_page": _per_page_for_depth(depth),
        "select": WORK_SELECT,
        "mailto": _mailto(),
    }
    key = _api_key()
    if key:
        params["api_key"] = key

    timeout = httpx.Timeout(30.0, connect=10.0)
    async with httpx.AsyncClient(
        base_url=OPENALEX_BASE,
        headers=_headers(),
        timeout=timeout,
        follow_redirects=True,
    ) as client:
        response = await client.get("/works", params=params)
        response.raise_for_status()
        payload = response.json()

    results = payload.get("results") or []
    return [map_work(item) for item in results if isinstance(item, dict)]
