"""Pandoc export — Markdown, HTML, and DOCX for completed articles (Phase 9).

Uses the system ``pandoc`` binary (do not vendor Haskell sources). Prefer
embedded Phase 8 APA References for numeric ``[n]`` fidelity; optionally run
``--citeproc`` with CSL-JSON when rewriting markers to ``[@citekey]``.
"""

from __future__ import annotations

import json
import logging
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from scholarly_api.models import BibliographyBundle, ComposedArticle, JobRecord

logger = logging.getLogger(__name__)

ExportFormat = Literal["md", "html", "docx"]

_REF_HEADING = re.compile(
    r"(?ms)^##\s+(References|Sources)\s*\n.*\Z",
)
_BRACKET_CITE = re.compile(r"\[(\d+)\]")

_MEDIA_TYPES: dict[ExportFormat, str] = {
    "md": "text/markdown; charset=utf-8",
    "html": "text/html; charset=utf-8",
    "docx": (
        "application/vnd.openxmlformats-officedocument"
        ".wordprocessingml.document"
    ),
}

_PANDOC_TO: dict[ExportFormat, str] = {
    "md": "gfm",
    "html": "html5",
    "docx": "docx",
}


@dataclass(frozen=True)
class ExportResult:
    """Bytes + metadata for an export download."""

    content: bytes
    media_type: str
    filename: str
    method: str
    format: ExportFormat


def pandoc_available() -> bool:
    return shutil.which("pandoc") is not None


def media_type_for(fmt: ExportFormat) -> str:
    return _MEDIA_TYPES[fmt]


def export_filename(job_id: str, fmt: ExportFormat) -> str:
    return f"proofpress-{job_id[:8]}.{fmt}"


def article_export_markdown(
    article: ComposedArticle,
    bibliography: BibliographyBundle | None = None,
) -> str:
    """Markdown body used for exports (title + sections + APA refs when present)."""
    md = (article.markdown or "").strip()
    if md:
        return md if md.endswith("\n") else md + "\n"
    # Fallback: rebuild a minimal document from HTML-less fields
    parts = [f"# {article.title}", ""]
    for sec in article.sections:
        if sec.heading:
            parts.append(f"## {sec.heading}")
            parts.append("")
        if sec.markdown:
            parts.append(sec.markdown.strip())
            parts.append("")
    if bibliography and bibliography.entries:
        parts.append("## References")
        parts.append("")
        for e in bibliography.entries:
            parts.append(f"{e.n}. [{e.citekey}] {e.apa}")
        parts.append("")
    return "\n".join(parts).rstrip() + "\n"


def _n_to_citekey(bibliography: BibliographyBundle) -> dict[int, str]:
    return {e.n: e.citekey for e in bibliography.entries}


def _rewrite_numeric_cites_to_pandoc(
    markdown: str,
    bibliography: BibliographyBundle,
) -> str:
    """Rewrite ``[n]`` → ``[@citekey]`` and drop the manual References appendix."""
    mapping = _n_to_citekey(bibliography)
    if not mapping:
        return markdown

    def repl(match: re.Match[str]) -> str:
        n = int(match.group(1))
        key = mapping.get(n)
        if key is None:
            return match.group(0)
        return f"[@{key}]"

    body = _REF_HEADING.sub("", markdown).rstrip() + "\n\n"
    # Only rewrite citation markers outside fenced code blocks (simple pass).
    parts: list[str] = []
    in_fence = False
    for line in body.splitlines(keepends=True):
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            parts.append(line)
            continue
        if in_fence:
            parts.append(line)
        else:
            parts.append(_BRACKET_CITE.sub(repl, line))
    return "".join(parts)


def _run_pandoc(
    markdown: str,
    fmt: ExportFormat,
    *,
    bibliography: BibliographyBundle | None = None,
    use_citeproc: bool = False,
    title: str | None = None,
) -> tuple[bytes, str]:
    """Invoke pandoc; returns (content, method_label)."""
    if not pandoc_available():
        raise RuntimeError(
            "pandoc is not installed — install the system package "
            "(e.g. `sudo apt-get install -y pandoc`) for MD/HTML/DOCX export"
        )

    to_fmt = _PANDOC_TO[fmt]
    with tempfile.TemporaryDirectory(prefix="proofpress-export-") as tmp:
        tmp_path = Path(tmp)
        src = tmp_path / "article.md"
        out = tmp_path / f"out.{fmt}"
        bib_path: Path | None = None
        md_body = markdown

        cmd = [
            "pandoc",
            str(src),
            "-f",
            "markdown",
            "-t",
            to_fmt,
            "-o",
            str(out),
        ]

        if title:
            cmd.extend(["--metadata", f"title={title}"])

        if fmt == "html":
            cmd.append("--standalone")
            cmd.extend(
                [
                    "--metadata",
                    "lang=en",
                ]
            )

        method = "pandoc"
        if (
            use_citeproc
            and bibliography
            and bibliography.csl_json
        ):
            md_body = _rewrite_numeric_cites_to_pandoc(markdown, bibliography)
            bib_path = tmp_path / "refs.json"
            bib_path.write_text(
                json.dumps(bibliography.csl_json, ensure_ascii=False),
                encoding="utf-8",
            )
            cmd.extend(
                [
                    "--citeproc",
                    f"--bibliography={bib_path}",
                ]
            )
            csl = Path("/usr/share/pandoc/data/default.csl")
            if csl.is_file():
                cmd.append(f"--csl={csl}")
            method = "pandoc+citeproc"

        src.write_text(md_body, encoding="utf-8")
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=False,
            timeout=60,
        )
        if proc.returncode != 0 or not out.is_file():
            err = (proc.stderr or proc.stdout or "unknown pandoc error").strip()
            raise RuntimeError(f"pandoc failed ({proc.returncode}): {err[:500]}")

        return out.read_bytes(), method


def export_article(
    job: JobRecord,
    fmt: ExportFormat,
    *,
    prefer_citeproc: bool = True,
) -> ExportResult:
    """Export a job's article to ``md`` / ``html`` / ``docx``.

    Markdown prefers the Phase 8 embedded APA bibliography (keeps ``[n]``).
    HTML/DOCX use pandoc; citeproc is attempted when CSL-JSON is present, with
    automatic fallback to embedded-references conversion.
    """
    if fmt not in _MEDIA_TYPES:
        raise ValueError(f"Unsupported export format: {fmt}")

    article = job.article
    if article is None or not (
        (article.markdown and article.markdown.strip())
        or article.sections
        or (article.html and article.html.strip())
    ):
        raise ValueError("Article not ready yet (wait for the draft/cite stages)")

    md = article_export_markdown(article, job.bibliography)
    filename = export_filename(job.id, fmt)
    media = media_type_for(fmt)

    # Markdown: serve canonical article markdown with Phase 8 APA References and
    # numeric [n] markers. Avoid pandoc GFM rewrite — it escapes [n] as \[n\].
    if fmt == "md":
        method = "raw_markdown+pandoc_available" if pandoc_available() else "raw_markdown"
        return ExportResult(
            content=md.encode("utf-8"),
            media_type=media,
            filename=filename,
            method=method,
            format=fmt,
        )

    # HTML / DOCX require pandoc
    if not pandoc_available():
        raise RuntimeError(
            "pandoc is not installed — install the system package "
            "(e.g. `sudo apt-get install -y pandoc`) for HTML/DOCX export"
        )

    last_error: Exception | None = None
    if prefer_citeproc and job.bibliography and job.bibliography.csl_json:
        try:
            content, method = _run_pandoc(
                md,
                fmt,
                bibliography=job.bibliography,
                use_citeproc=True,
                title=article.title,
            )
            return ExportResult(
                content=content,
                media_type=media,
                filename=filename,
                method=method,
                format=fmt,
            )
        except (RuntimeError, OSError, subprocess.SubprocessError, TimeoutError) as exc:
            last_error = exc
            logger.warning("pandoc citeproc export failed; falling back: %s", exc)

    try:
        content, method = _run_pandoc(
            md,
            fmt,
            bibliography=None,
            use_citeproc=False,
            title=article.title,
        )
        if last_error is not None:
            method = f"{method}+embedded_refs"
        return ExportResult(
            content=content,
            media_type=media,
            filename=filename,
            method=method,
            format=fmt,
        )
    except (RuntimeError, OSError, subprocess.SubprocessError, TimeoutError) as exc:
        if last_error is not None:
            raise RuntimeError(
                f"pandoc export failed (citeproc and embedded): {exc}"
            ) from exc
        raise
