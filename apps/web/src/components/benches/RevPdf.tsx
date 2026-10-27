"use client";

import { useMemo, useState } from "react";
import { Bench, Notice, usePhase } from "@/components/ui";
import { sampleDocument } from "@/data";
import { groupLabel, mustFeature } from "@/features";
import { escapeRegExp, extractLoosePdfText, outlineOf, paginate } from "@/lib/text";

function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(needle)})`, "ig"));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === needle.toLowerCase() ? <mark key={`${part}-${index}`}>{part}</mark> : <span key={`${part}-${index}`}>{part}</span>,
      )}
    </>
  );
}

export function RevPdf() {
  const feature = mustFeature("revpdf");
  const [pages, setPages] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const { phase, message, run, clear } = usePhase();
  const outline = useMemo(() => outlineOf(pages), [pages]);
  const matches = pages
    .map((text, index) => ({ text, index }))
    .filter((item) => !query.trim() || item.text.toLowerCase().includes(query.trim().toLowerCase()));

  async function openText(name: string, text: string) {
    await run(async () => {
      const trimmed = text.trim();
      if (trimmed.length < 1) throw new Error("That file has no readable text.");
      const next = paginate(trimmed);
      setPages(next);
      setTitle(name);
      setPage(0);
      setQuery("");
    });
  }

  async function openFile(file: File) {
    if (file.size > 8_000_000) {
      await run(async () => {
        throw new Error("Keep the file under 8 MB for this preview.");
      });
      return;
    }
    const lower = file.name.toLowerCase();
    const isPdf = lower.endsWith(".pdf") || file.type === "application/pdf";
    const isText = lower.endsWith(".txt") || lower.endsWith(".md") || file.type.startsWith("text/");
    if (!isPdf && !isText) {
      await run(async () => {
        throw new Error("Bring a .txt, .md, or .pdf file.");
      });
      return;
    }
    await run(async () => {
      if (isPdf) {
        const buffer = await file.arrayBuffer();
        const text = extractLoosePdfText(buffer);
        if (text.length < 40) {
          throw new Error("This PDF looks compressed or image-only. Open a text export, or use the sample document.");
        }
        const next = paginate(text);
        setPages(next);
        setTitle(file.name);
        setPage(0);
        return;
      }
      const text = await file.text();
      if (!text.trim()) throw new Error("That file has no readable text.");
      setPages(paginate(text));
      setTitle(file.name);
      setPage(0);
    });
  }

  const current = pages[page] ?? "";

  return (
    <Bench
      kicker={groupLabel(feature.group)}
      title={feature.name}
      lede={feature.summary}
      layout="stack"
      result={
        phase === "loading" ? (
          <Notice tone="loading" title="Reading the file">The pages stay in this browser.</Notice>
        ) : phase === "error" ? (
          <Notice tone="error" title="Needs a fix">{message}</Notice>
        ) : pages.length === 0 ? (
          <Notice tone="empty" title="No document open">Open the sample, or drop a text file or a simple PDF.</Notice>
        ) : (
          <div className="pdf-desk">
            <div className="pdf-tools">
              <p className="kicker">
                {title} · page {page + 1} of {pages.length}
              </p>
              <label className="field">
                <span>Search</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a phrase" />
              </label>
              {matches.length === 0 ? <Notice tone="empty" title="No pages contain that">Clear the search to see every page.</Notice> : null}
              <div className="choice-row">
                {(query.trim() ? matches : pages.map((text, index) => ({ text, index }))).map((item) => (
                  <button key={item.index} type="button" className="choice" aria-pressed={item.index === page} onClick={() => setPage(item.index)}>
                    Page {item.index + 1}
                  </button>
                ))}
              </div>
              {outline.length > 0 ? (
                <div className="lesson-list">
                  {outline.map((item) => (
                    <button key={`${item.page}-${item.title}`} type="button" className="choice lesson" onClick={() => setPage(item.page)}>
                      <span>{item.title}</span>
                      <small>p.{item.page + 1}</small>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <article className="page-sheet">
              <Highlight text={current} query={query} />
            </article>
          </div>
        )
      }
    >
      <div
        className="dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file) void openFile(file);
        }}
      >
        <p>Drop a .txt, .md, or .pdf here, or choose a file.</p>
        <input
          type="file"
          accept=".txt,.md,.pdf,text/plain,application/pdf"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void openFile(file);
          }}
        />
      </div>
      <div className="form-actions">
        <button type="button" className="btn primary" onClick={() => void openText("Sample bench notes", sampleDocument)}>
          Open sample
        </button>
        {pages.length > 0 ? (
          <button
            type="button"
            className="btn quiet"
            onClick={() => {
              setPages([]);
              setTitle("");
              clear();
            }}
          >
            Close document
          </button>
        ) : null}
      </div>
    </Bench>
  );
}
