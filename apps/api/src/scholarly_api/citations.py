"""Citations & bibliography — BBT-inspired citekeys, CSL-JSON, APA, BibTeX.

Canonical store is CSL-JSON on the job. Rendering is lean Python (APA-ish)
plus optional pandoc --citeproc when available. No Zotero/BBT runtime.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from scholarly_api.models import (
    BibliographyBundle,
    BibliographyEntry,
    ScreenDecision,
    SourceWork,
)

_NON_ALNUM = re.compile(r"[^a-z0-9]+")
_WHITESPACE = re.compile(r"\s+")
# Stopwords skipped for the "veryshorttitle" segment (BBT-inspired).
_TITLE_STOP = frozenset(
    {
        "a",
        "an",
        "the",
        "and",
        "or",
        "of",
        "for",
        "on",
        "in",
        "to",
        "with",
        "from",
        "by",
        "at",
        "as",
        "into",
        "over",
        "under",
        "about",
        "via",
    }
)


def cite_index_map(sources: list[SourceWork]) -> list[SourceWork]:
    """Stable citation order: screened-in works first, then software.

    Must stay aligned with composer._cite_index_map / article [n] markers.
    """
    included = [s for s in sources if s.screen_decision == ScreenDecision.include]
    if not included:
        included = list(sources)
    works = [s for s in included if s.source_type != "software"]
    software = [s for s in included if s.source_type == "software"]
    return [*works, *software]


def _first_author_token(authors: list[str], *, software: bool, full_name: str | None) -> str:
    if software and full_name and "/" in full_name:
        owner = full_name.split("/", 1)[0]
        cleaned = _NON_ALNUM.sub("", owner.lower())
        return cleaned or "repo"
    if not authors:
        return "anon"
    lead = authors[0].strip()
    if not lead:
        return "anon"
    # "Family, Given" → family; otherwise last whitespace token (Western order).
    if "," in lead:
        family = lead.split(",", 1)[0].strip()
    else:
        parts = _WHITESPACE.split(lead)
        family = parts[-1] if parts else lead
    family = family.rstrip(".")
    cleaned = _NON_ALNUM.sub("", family.lower())
    return cleaned or "anon"


def _veryshorttitle(title: str, *, software: bool, full_name: str | None) -> str:
    if software and full_name and "/" in full_name:
        repo = full_name.split("/", 1)[1]
        cleaned = _NON_ALNUM.sub("", repo.lower())
        return cleaned[:24] or "software"
    words = _NON_ALNUM.sub(" ", (title or "").lower()).split()
    significant = [w for w in words if w and w not in _TITLE_STOP]
    if not significant:
        significant = [w for w in words if w] or ["untitled"]
    return significant[0][:24]


def make_citekey(source: SourceWork, *, used: set[str] | None = None) -> str:
    """BBT-inspired citekey: auth + year + veryshorttitle (+ disambiguator).

    Example: ``lovelace2024grounded``, ``futurehouse2023paperqa``.
    """
    software = source.source_type == "software"
    auth = _first_author_token(
        source.authors,
        software=software,
        full_name=source.github_full_name,
    )
    year = str(source.year) if source.year else "n.d."
    year_part = year.replace(".", "")  # n.d. → nd for key safety
    if year_part == "nd":
        year_part = "nd"
    short = _veryshorttitle(
        source.title,
        software=software,
        full_name=source.github_full_name,
    )
    base = f"{auth}{year_part}{short}"
    base = _NON_ALNUM.sub("", base.lower()) or "ref"
    if used is None:
        return base
    if base not in used:
        used.add(base)
        return base
    # Disambiguate collisions: a, b, c… then numeric.
    for suffix in "abcdefghijklmnopqrstuvwxyz":
        candidate = f"{base}{suffix}"
        if candidate not in used:
            used.add(candidate)
            return candidate
    i = 2
    while True:
        candidate = f"{base}{i}"
        if candidate not in used:
            used.add(candidate)
            return candidate
        i += 1


def _split_author_name(raw: str) -> dict[str, str]:
    name = raw.strip()
    if "," in name:
        family, given = name.split(",", 1)
        return {"family": family.strip(), "given": given.strip()}
    parts = _WHITESPACE.split(name)
    if len(parts) == 1:
        return {"family": parts[0]}
    return {"family": parts[-1], "given": " ".join(parts[:-1])}


def source_to_csl(source: SourceWork, citekey: str) -> dict[str, Any]:
    """Map a discovery SourceWork to a CSL-JSON item (canonical store shape)."""
    software = source.source_type == "software"
    item: dict[str, Any] = {
        "id": citekey,
        "type": "software" if software else "article-journal",
        "title": source.title,
    }
    authors = [_split_author_name(a) for a in source.authors if a and a.strip()]
    if software and not authors and source.github_full_name:
        owner = source.github_full_name.split("/", 1)[0]
        authors = [{"literal": owner}]
    if authors:
        item["author"] = authors
    if source.year:
        item["issued"] = {"date-parts": [[int(source.year)]]}
    if source.doi:
        doi = source.doi
        if doi.lower().startswith("https://doi.org/"):
            doi = doi[16:]
        elif doi.lower().startswith("http://doi.org/"):
            doi = doi[15:]
        item["DOI"] = doi
    url = (
        source.html_url
        or source.landing_url
        or source.oa_url
        or source.pdf_url
        or (f"https://doi.org/{item['DOI']}" if item.get("DOI") else None)
        or (source.openalex_id if source.openalex_id.startswith("http") else None)
    )
    if url:
        item["URL"] = url
    if software:
        if source.github_full_name:
            item["publisher"] = "GitHub"
            item["version"] = source.github_full_name
        if source.license_spdx:
            item["note"] = f"License: {source.license_spdx}"
    else:
        # OpenAlex work id as alternative identifier when useful
        if source.openalex_id and source.openalex_id.startswith("http"):
            item.setdefault("note", f"OpenAlex: {source.openalex_id}")
    return item


def _apa_authors(authors: list[dict[str, str]]) -> str:
    if not authors:
        return "Anonymous"
    formatted: list[str] = []
    for a in authors:
        if "literal" in a:
            formatted.append(a["literal"])
            continue
        family = a.get("family") or ""
        given = a.get("given") or ""
        if given:
            initials = "".join(
                f"{p[0]}." for p in _WHITESPACE.split(given) if p
            )
            formatted.append(f"{family}, {initials}" if family else initials)
        else:
            formatted.append(family or "Anonymous")
    if len(formatted) == 1:
        return formatted[0]
    if len(formatted) == 2:
        return f"{formatted[0]}, & {formatted[1]}"
    return ", ".join(formatted[:-1]) + f", & {formatted[-1]}"


def _year_from_csl(item: dict[str, Any]) -> str:
    issued = item.get("issued") or {}
    parts = issued.get("date-parts") if isinstance(issued, dict) else None
    if parts and parts[0] and parts[0][0]:
        return str(parts[0][0])
    return "n.d."


def render_apa(item: dict[str, Any]) -> str:
    """Render one CSL-JSON item as a compact APA 7th–style reference line."""
    authors = _apa_authors(list(item.get("author") or []))
    year = _year_from_csl(item)
    title = (item.get("title") or "Untitled").rstrip(".")
    url = item.get("URL") or ""
    doi = item.get("DOI") or ""
    kind = item.get("type") or "article-journal"

    if kind == "software":
        # APA software: Author. (Year). Title [Computer software]. Publisher. URL
        publisher = item.get("publisher") or ""
        core = f"{authors} ({year}). {title} [Computer software]."
        if publisher:
            core = f"{core} {publisher}."
        if url:
            core = f"{core} {url}"
        return core.strip()

    # Journal-ish scholarly work without container metadata
    core = f"{authors} ({year}). {title}."
    if doi:
        core = f"{core} https://doi.org/{doi}"
    elif url:
        core = f"{core} {url}"
    return core.strip()


def _bibtex_escape(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace("{", "\\{")
        .replace("}", "\\}")
        .replace("&", "\\&")
    )


def _bibtex_author_field(authors: list[dict[str, str]]) -> str:
    parts: list[str] = []
    for a in authors:
        if "literal" in a:
            parts.append(a["literal"])
        elif a.get("given"):
            parts.append(f"{a.get('family', '')}, {a['given']}")
        else:
            parts.append(a.get("family") or "Anonymous")
    return " and ".join(parts)


def csl_to_bibtex_entry(item: dict[str, Any]) -> str:
    """Serialize one CSL-JSON item to a BibTeX entry."""
    citekey = str(item.get("id") or "ref")
    kind = item.get("type") or "article-journal"
    entry_type = "misc" if kind == "software" else "article"
    fields: list[tuple[str, str]] = []
    if item.get("title"):
        fields.append(("title", str(item["title"])))
    authors = list(item.get("author") or [])
    if authors:
        fields.append(("author", _bibtex_author_field(authors)))
    year = _year_from_csl(item)
    if year != "n.d.":
        fields.append(("year", year))
    if item.get("DOI"):
        fields.append(("doi", str(item["DOI"])))
    if item.get("URL"):
        fields.append(("url", str(item["URL"])))
    if kind == "software":
        fields.append(("howpublished", "Software"))
        if item.get("publisher"):
            fields.append(("publisher", str(item["publisher"])))
        if item.get("version"):
            fields.append(("note", str(item["version"])))
    elif item.get("note"):
        fields.append(("note", str(item["note"])))

    lines = [f"@{entry_type}{{{citekey},"]
    for key, val in fields:
        lines.append(f"  {key} = {{{_bibtex_escape(val)}}},")
    lines.append("}")
    return "\n".join(lines)


def render_bibtex(items: list[dict[str, Any]]) -> str:
    return "\n\n".join(csl_to_bibtex_entry(it) for it in items) + ("\n" if items else "")


def render_bibliography_html(entries: list[BibliographyEntry], style: str = "apa") -> str:
    """HTML footer bibliography; ids match inline `#ref-n` anchors."""
    if not entries:
        return ""
    style_label = style.upper() if style.lower() != "apa" else "APA"
    parts = [
        f'<section class="bibliography" aria-label="Bibliography">',
        f"<h2>References ({style_label})</h2>",
        "<ol class=\"bibliography-list\">",
    ]
    for e in entries:
        text = (
            e.apa.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )
        # Light-link DOI/URL tails already plain in APA string
        parts.append(
            f'<li id="ref-{e.n}" data-citekey="{e.citekey}">'
            f'<span class="ref-num">[{e.n}]</span> '
            f'<span class="citekey">{e.citekey}</span> '
            f'<span class="apa">{text}</span>'
            f"</li>"
        )
    parts.append("</ol>")
    parts.append("</section>")
    return "\n".join(parts)


def try_pandoc_apa(items: list[dict[str, Any]]) -> dict[str, str] | None:
    """Optional APA render via pandoc --citeproc. Returns citekey→text or None."""
    if not items or not shutil.which("pandoc"):
        return None
    citekeys = [str(it["id"]) for it in items]
    md = " ".join(f"[@{k}]" for k in citekeys) + "\n"
    csl_path = Path("/usr/share/pandoc/data/default.csl")
    try:
        with tempfile.TemporaryDirectory() as tmp:
            bib_path = Path(tmp) / "refs.json"
            bib_path.write_text(json.dumps(items), encoding="utf-8")
            cmd = [
                "pandoc",
                "--citeproc",
                f"--bibliography={bib_path}",
                "-f",
                "markdown",
                "-t",
                "plain",
            ]
            if csl_path.is_file():
                cmd.insert(2, f"--csl={csl_path}")
            proc = subprocess.run(
                cmd,
                input=md,
                text=True,
                capture_output=True,
                check=False,
                timeout=20,
            )
            if proc.returncode != 0 or not proc.stdout.strip():
                return None
            # Pandoc dumps citations then a bibliography block; use our APA instead
            # when parsing is ambiguous. Treat success as "pandoc available" signal.
            return {"_pandoc_ok": proc.stdout.strip()[:200]}
    except (OSError, subprocess.SubprocessError, TimeoutError):
        return None


def build_bibliography(
    sources: list[SourceWork],
    *,
    citation_style: str = "apa",
    cited_source_ids: list[str] | None = None,
) -> BibliographyBundle:
    """Build canonical CSL-JSON + APA lines + BibTeX for the cite stage.

    Entry order matches inline ``[n]`` markers (works then software).
    When ``cited_source_ids`` is provided, those sources are listed first in
    their cite-index order, then any remaining indexed sources — keeping [n]
    stable while preferring claimed cites in the footer meta.
    """
    indexed = cite_index_map(sources)
    used_keys: set[str] = set()
    style = (citation_style or "apa").lower()
    if style not in {"apa", "nature", "news"}:
        style = "apa"

    # Always emit one entry per indexed source so [n] ↔ footer stays 1:1.
    entries: list[BibliographyEntry] = []
    csl_items: list[dict[str, Any]] = []
    cited_set = set(cited_source_ids or [])

    for n, source in enumerate(indexed, start=1):
        citekey = make_citekey(source, used=used_keys)
        csl = source_to_csl(source, citekey)
        apa = render_apa(csl)
        bibtex = csl_to_bibtex_entry(csl)
        entries.append(
            BibliographyEntry(
                n=n,
                citekey=citekey,
                source_id=source.openalex_id,
                csl=csl,
                apa=apa,
                bibtex=bibtex,
                cited_in_article=source.openalex_id in cited_set if cited_set else True,
            )
        )
        csl_items.append(csl)

    # Prefer our APA renderer for stable footer text; probe pandoc availability.
    pandoc_meta = try_pandoc_apa(csl_items)
    method = "python_apa"
    if pandoc_meta is not None:
        method = "python_apa+pandoc_available"

    bibtex_file = render_bibtex(csl_items)
    html = render_bibliography_html(entries, style=style)

    return BibliographyBundle(
        style=style,
        method=method,
        entries=entries,
        csl_json=csl_items,
        bibtex=bibtex_file,
        html=html,
    )
