"""Build a per-job evidence pack from screened-in sources.

Fetches OA PDFs when OpenAlex already marked a legal OA PDF URL.
Never bypasses paywalls. Falls back to abstracts / README text.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx

from scholarly_api.github_client import _decode_content, _headers as github_headers
from scholarly_api.models import ScreenDecision, SourceWork
from scholarly_api.openalex import (
    OPENALEX_BASE,
    _headers as openalex_headers,
    _mailto,
    _api_key,
    reconstruct_abstract,
)

USER_AGENT = "ProofPress/0.4 (+https://github.com/CrimeSelvaraj/SelvarajArunachalam)"
DEFAULT_PACK_ROOT = Path(
    os.getenv("EVIDENCE_PACK_ROOT", "").strip()
    or (Path(__file__).resolve().parents[2] / "data" / "evidence")
)
MAX_PDF_BYTES = int(os.getenv("EVIDENCE_MAX_PDF_BYTES", str(12 * 1024 * 1024)))
MAX_TEXT_CHARS = int(os.getenv("EVIDENCE_MAX_TEXT_CHARS", "40000"))
README_FETCH_LIMIT = 12000

_SAFE_NAME = re.compile(r"[^a-zA-Z0-9._-]+")


@dataclass
class PackFile:
    source_id: str
    relative_path: str
    kind: str  # pdf | abstract | readme | text
    bytes: int
    title: str
    absolute_path: Path
    citation: str | None = None
    doi: str | None = None
    authors: list[str] = field(default_factory=list)


@dataclass
class EvidencePackResult:
    directory: Path
    files: list[PackFile]
    source_count: int
    notes: list[str] = field(default_factory=list)

    @property
    def pdf_count(self) -> int:
        return sum(1 for f in self.files if f.kind == "pdf")

    @property
    def text_count(self) -> int:
        return sum(1 for f in self.files if f.kind != "pdf")


def pack_root() -> Path:
    root = DEFAULT_PACK_ROOT
    root.mkdir(parents=True, exist_ok=True)
    return root


def job_pack_dir(job_id: str) -> Path:
    safe = _SAFE_NAME.sub("_", job_id)[:80] or "job"
    path = pack_root() / safe
    path.mkdir(parents=True, exist_ok=True)
    return path


def _slug(text: str, limit: int = 48) -> str:
    cleaned = _SAFE_NAME.sub("-", text.strip().lower()).strip("-")
    return (cleaned or "source")[:limit]


def _source_stem(source: SourceWork, index: int) -> str:
    if source.source_type == "software" and source.github_full_name:
        return f"{index:02d}_sw_{_slug(source.github_full_name.replace('/', '_'))}"
    title_bit = _slug(source.title or "work")
    return f"{index:02d}_work_{title_bit}"


def _truncate(text: str, limit: int = MAX_TEXT_CHARS) -> str:
    text = text.strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rsplit(" ", 1)[0] + "…"


def _write_text(path: Path, body: str) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = body.encode("utf-8")
    path.write_bytes(data)
    return len(data)


async def _fetch_openalex_abstract(
    client: httpx.AsyncClient, source: SourceWork
) -> str | None:
    """Re-fetch full abstract for a work (discovery only kept a short snippet)."""
    work_id = source.openalex_id
    if not work_id or source.source_type == "software":
        return source.abstract_snippet

    # Accept full URL or bare OpenAlex id
    path = work_id
    if path.startswith("https://openalex.org/"):
        path = "/" + path.rsplit("/", 1)[-1]
    elif path.startswith("http"):
        return source.abstract_snippet
    elif not path.startswith("/"):
        path = f"/{path}"

    params: dict[str, Any] = {
        "select": "id,abstract_inverted_index,title,display_name",
        "mailto": _mailto(),
    }
    key = _api_key()
    if key:
        params["api_key"] = key

    try:
        response = await client.get(path, params=params)
        if response.status_code == 404:
            return source.abstract_snippet
        response.raise_for_status()
        payload = response.json()
        abstract = reconstruct_abstract(payload.get("abstract_inverted_index"))
        return abstract or source.abstract_snippet
    except httpx.HTTPError:
        return source.abstract_snippet


async def _fetch_github_readme(
    client: httpx.AsyncClient, full_name: str
) -> str | None:
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


async def _try_download_oa_pdf(
    client: httpx.AsyncClient,
    source: SourceWork,
    dest: Path,
) -> tuple[bool, str | None]:
    """Download OA PDF only when source is marked OA and has pdf_url. No paywall bypass."""
    if not source.is_oa:
        return False, "not_oa"
    url = source.pdf_url or source.oa_url
    if not url:
        return False, "no_pdf_url"
    # Skip obvious HTML landing pages without .pdf when oa_url is used as fallback
    if url == source.oa_url and source.pdf_url is None:
        if ".pdf" not in url.lower():
            return False, "oa_url_not_pdf"

    try:
        async with client.stream(
            "GET",
            url,
            headers={"User-Agent": USER_AGENT, "Accept": "application/pdf,*/*"},
            follow_redirects=True,
            timeout=httpx.Timeout(60.0, connect=15.0),
        ) as response:
            if response.status_code >= 400:
                return False, f"http_{response.status_code}"
            content_type = (response.headers.get("content-type") or "").lower()
            # Some hosts omit content-type; still accept if URL ends with .pdf
            looks_pdf = (
                "pdf" in content_type
                or url.lower().endswith(".pdf")
                or "pdf" in (response.headers.get("content-disposition") or "").lower()
            )
            if not looks_pdf and "html" in content_type:
                return False, "html_not_pdf"

            dest.parent.mkdir(parents=True, exist_ok=True)
            total = 0
            with dest.open("wb") as out:
                async for chunk in response.aiter_bytes(chunk_size=64 * 1024):
                    total += len(chunk)
                    if total > MAX_PDF_BYTES:
                        out.close()
                        dest.unlink(missing_ok=True)
                        return False, "too_large"
                    out.write(chunk)

            if total < 64:
                dest.unlink(missing_ok=True)
                return False, "too_small"
            # Magic-byte check
            head = dest.read_bytes()[:5]
            if not head.startswith(b"%PDF"):
                dest.unlink(missing_ok=True)
                return False, "not_pdf_magic"
            return True, None
    except httpx.HTTPError as exc:
        dest.unlink(missing_ok=True)
        return False, f"error:{exc.__class__.__name__}"


def _citation_line(source: SourceWork) -> str:
    authors = ", ".join(source.authors[:3]) if source.authors else "Unknown"
    year = source.year or "n.d."
    if source.source_type == "software":
        return f"{authors} ({year}). {source.title}. {source.html_url or ''}".strip()
    doi = source.doi or ""
    return f"{authors} ({year}). {source.title}. {doi}".strip()


async def build_evidence_pack(
    job_id: str,
    sources: list[SourceWork],
) -> EvidencePackResult:
    """Write evidence files for included sources; mutate source.evidence_files."""
    included = [
        s
        for s in sources
        if s.screen_decision == ScreenDecision.include
    ]
    directory = job_pack_dir(job_id)
    files: list[PackFile] = []
    notes: list[str] = []

    oa_timeout = httpx.Timeout(30.0, connect=10.0)
    gh_timeout = httpx.Timeout(45.0, connect=10.0)
    pdf_timeout = httpx.Timeout(60.0, connect=15.0)

    async with httpx.AsyncClient(
        base_url=OPENALEX_BASE,
        headers=openalex_headers(),
        timeout=oa_timeout,
        follow_redirects=True,
    ) as oa_client, httpx.AsyncClient(
        base_url="https://api.github.com",
        headers=github_headers(),
        timeout=gh_timeout,
        follow_redirects=True,
    ) as gh_client, httpx.AsyncClient(
        timeout=pdf_timeout,
        follow_redirects=True,
    ) as fetch_client:
        for index, source in enumerate(included, start=1):
            stem = _source_stem(source, index)
            written: list[str] = []
            citation = _citation_line(source)

            if source.source_type == "software":
                readme: str | None = None
                if source.github_full_name:
                    readme = await _fetch_github_readme(
                        gh_client, source.github_full_name
                    )
                if not readme:
                    readme = source.readme_snippet or source.abstract_snippet
                if readme:
                    body = _truncate(readme, README_FETCH_LIMIT)
                    header = (
                        f"# {source.github_full_name or source.title}\n"
                        f"URL: {source.html_url or source.landing_url or ''}\n"
                        f"License: {source.license_spdx or 'unknown'}\n\n"
                    )
                    rel = f"{stem}_readme.md"
                    abs_path = directory / rel
                    nbytes = _write_text(abs_path, header + body)
                    pack_file = PackFile(
                        source_id=source.openalex_id,
                        relative_path=rel,
                        kind="readme",
                        bytes=nbytes,
                        title=source.github_full_name or source.title,
                        absolute_path=abs_path,
                        citation=citation,
                        authors=list(source.authors),
                    )
                    files.append(pack_file)
                    written.append(rel)
                else:
                    notes.append(f"no_readme:{source.openalex_id}")
            else:
                pdf_rel = f"{stem}.pdf"
                pdf_path = directory / pdf_rel
                ok, reason = await _try_download_oa_pdf(
                    fetch_client, source, pdf_path
                )
                if ok:
                    pack_file = PackFile(
                        source_id=source.openalex_id,
                        relative_path=pdf_rel,
                        kind="pdf",
                        bytes=pdf_path.stat().st_size,
                        title=source.title,
                        absolute_path=pdf_path,
                        citation=citation,
                        doi=source.doi,
                        authors=list(source.authors),
                    )
                    files.append(pack_file)
                    written.append(pdf_rel)
                else:
                    notes.append(f"pdf_skip:{source.openalex_id}:{reason}")

                abstract = await _fetch_openalex_abstract(oa_client, source)
                if not abstract:
                    abstract = source.abstract_snippet
                if abstract:
                    body = _truncate(abstract)
                    header = (
                        f"Title: {source.title}\n"
                        f"Authors: {', '.join(source.authors) or 'Unknown'}\n"
                        f"Year: {source.year or 'n.d.'}\n"
                        f"DOI: {source.doi or ''}\n"
                        f"OpenAlex: {source.openalex_id}\n"
                        f"OA status: {source.oa_status or ('oa' if source.is_oa else 'unknown')}\n\n"
                        "Abstract:\n"
                    )
                    rel = f"{stem}_abstract.txt"
                    abs_path = directory / rel
                    nbytes = _write_text(abs_path, header + body)
                    pack_file = PackFile(
                        source_id=source.openalex_id,
                        relative_path=rel,
                        kind="abstract",
                        bytes=nbytes,
                        title=source.title,
                        absolute_path=abs_path,
                        citation=citation,
                        doi=source.doi,
                        authors=list(source.authors),
                    )
                    files.append(pack_file)
                    written.append(rel)
                elif not written:
                    notes.append(f"no_text:{source.openalex_id}")

            source.evidence_files = written

    manifest = directory / "manifest.txt"
    lines = [
        f"job_id={job_id}",
        f"sources={len(included)}",
        f"files={len(files)}",
        "",
    ]
    for f in files:
        lines.append(f"{f.kind}\t{f.source_id}\t{f.relative_path}\t{f.bytes}")
    if notes:
        lines.append("")
        lines.append("notes:")
        lines.extend(notes)
    _write_text(manifest, "\n".join(lines) + "\n")

    return EvidencePackResult(
        directory=directory,
        files=files,
        source_count=len(included),
        notes=notes,
    )
