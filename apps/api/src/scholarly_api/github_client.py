"""GitHub REST search + repo metadata — README and CITATION.cff when present."""

from __future__ import annotations

import asyncio
import base64
import os
import re
from typing import Any

import httpx

from scholarly_api.models import SourceWork

GITHUB_API = "https://api.github.com"
USER_AGENT = "ProofPress/0.3 (+https://github.com/CrimeSelvaraj/SelvarajArunachalam)"
DEFAULT_MAX_REPOS = 5
README_SNIPPET_LIMIT = 320
CITATION_CFF_LIMIT = 480


def _token() -> str | None:
    key = os.getenv("GITHUB_TOKEN", "").strip()
    return key or None


def _headers() -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": USER_AGENT,
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = _token()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def truncate_text(text: str | None, limit: int) -> str | None:
    if not text:
        return None
    cleaned = re.sub(r"\s+", " ", text.strip())
    if not cleaned:
        return None
    if len(cleaned) <= limit:
        return cleaned
    cut = cleaned[: limit - 1].rsplit(" ", 1)[0]
    return f"{cut}…"


def _license_spdx(repo: dict[str, Any]) -> str | None:
    lic = repo.get("license")
    if not isinstance(lic, dict):
        return None
    spdx = lic.get("spdx_id")
    if spdx and spdx != "NOASSERTION":
        return str(spdx)
    name = lic.get("name")
    return str(name) if name else None


def _decode_content(payload: dict[str, Any]) -> str | None:
    raw = payload.get("content")
    if not raw or not isinstance(raw, str):
        return None
    try:
        decoded = base64.b64decode(raw, validate=False).decode("utf-8", errors="replace")
    except (ValueError, UnicodeDecodeError):
        return None
    return decoded.strip() or None


def map_repo(
    repo: dict[str, Any],
    *,
    readme_text: str | None,
    citation_cff: str | None,
) -> SourceWork:
    full_name = str(repo.get("full_name") or repo.get("name") or "unknown/repo")
    html_url = str(repo.get("html_url") or f"https://github.com/{full_name}")
    owner = repo.get("owner") or {}
    owner_login = owner.get("login") if isinstance(owner, dict) else None
    description = repo.get("description")
    title = str(description or full_name)
    readme_snippet = truncate_text(readme_text, README_SNIPPET_LIMIT)
    snippet = readme_snippet or truncate_text(
        str(description) if description else None, README_SNIPPET_LIMIT
    )
    updated = repo.get("updated_at")
    year: int | None = None
    if isinstance(updated, str) and len(updated) >= 4:
        try:
            year = int(updated[:4])
        except ValueError:
            year = None

    return SourceWork(
        openalex_id=f"github:{full_name}",
        title=title,
        authors=[str(owner_login)] if owner_login else [],
        year=year,
        abstract_snippet=snippet,
        landing_url=html_url,
        source_type="software",
        github_full_name=full_name,
        html_url=html_url,
        stars=repo.get("stargazers_count"),
        license_spdx=_license_spdx(repo),
        readme_snippet=readme_snippet,
        citation_cff=truncate_text(citation_cff, CITATION_CFF_LIMIT),
    )


async def _fetch_readme(client: httpx.AsyncClient, full_name: str) -> str | None:
    try:
        response = await client.get(f"/repos/{full_name}/readme")
        if response.status_code == 404:
            return None
        response.raise_for_status()
        data = response.json()
        if isinstance(data, dict):
            return _decode_content(data)
    except httpx.HTTPError:
        return None
    return None


async def _fetch_citation_cff(client: httpx.AsyncClient, full_name: str) -> str | None:
    try:
        response = await client.get(f"/repos/{full_name}/contents/CITATION.cff")
        if response.status_code == 404:
            return None
        response.raise_for_status()
        data = response.json()
        if isinstance(data, dict):
            return _decode_content(data)
    except httpx.HTTPError:
        return None
    return None


async def _enrich_repo(
    client: httpx.AsyncClient, repo: dict[str, Any]
) -> SourceWork | None:
    if not isinstance(repo, dict):
        return None
    full_name = repo.get("full_name")
    if not full_name:
        return None
    readme_task = _fetch_readme(client, str(full_name))
    cff_task = _fetch_citation_cff(client, str(full_name))
    readme_text, citation_cff = await asyncio.gather(readme_task, cff_task)
    return map_repo(repo, readme_text=readme_text, citation_cff=citation_cff)


async def search_repositories(
    topic: str,
    *,
    max_repos: int = DEFAULT_MAX_REPOS,
) -> list[SourceWork]:
    """Search GitHub repositories related to topic; enrich with README / CITATION.cff."""
    query = topic.strip()
    if not query:
        return []

    # Qualifiers keep results on-topic without exploding the search space.
    search_q = f"{query} in:name,description,readme"
    params = {
        "q": search_q,
        "sort": "stars",
        "order": "desc",
        "per_page": min(max(1, max_repos), 10),
    }

    timeout = httpx.Timeout(45.0, connect=10.0)
    async with httpx.AsyncClient(
        base_url=GITHUB_API,
        headers=_headers(),
        timeout=timeout,
        follow_redirects=True,
    ) as client:
        response = await client.get("/search/repositories", params=params)
        response.raise_for_status()
        payload = response.json()
        items = payload.get("items") or []
        if not isinstance(items, list):
            return []

        enrichments = await asyncio.gather(
            *[_enrich_repo(client, item) for item in items if isinstance(item, dict)]
        )

    results: list[SourceWork] = []
    for mapped in enrichments:
        if mapped is not None:
            results.append(mapped)
    return results
