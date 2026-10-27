"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PublicBook } from "@/lib/types";
import styles from "./screens.module.css";

type SortMode = "recent" | "title" | "finished";

export function LibraryManager({ initialBooks }: { initialBooks: PublicBook[] }) {
  const [books, setBooks] = useState(initialBooks);
  const [file, setFile] = useState<File | null>(null);
  const [sort, setSort] = useState<SortMode>("recent");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  const visible = useMemo(() => {
    const next = [...books];
    if (sort === "title") {
      next.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "finished") {
      next.sort((a, b) => Number(Boolean(b.finishedAt)) - Number(Boolean(a.finishedAt)));
    } else {
      next.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    }
    return next;
  }, [books, sort]);

  async function upload(nextFile: File | null) {
    if (!nextFile) return;
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.set("file", nextFile);
    const res = await fetch("/api/library", { method: "POST", body });
    const data = (await res.json()) as { book?: PublicBook; error?: string };
    setBusy(false);
    if (!res.ok || !data.book) {
      setError(data.error || "That file could not be added.");
      return;
    }
    setBooks((current) => [data.book!, ...current.filter((book) => book.id !== data.book!.id)]);
    setFile(null);
    setInputKey((key) => key + 1);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/library/${id}`, { method: "DELETE" });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Could not remove that book.");
      return;
    }
    setBooks((current) => current.filter((book) => book.id !== id));
  }

  return (
    <div className={styles.form}>
      {error ? (
        <p className={styles.alert} role="alert">
          {error}
        </p>
      ) : null}
      <form
        className={styles.drop}
        onSubmit={(event) => {
          event.preventDefault();
          void upload(file);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          const dropped = event.dataTransfer.files[0];
          if (dropped) {
            setFile(dropped);
            void upload(dropped);
          }
        }}
        data-active={dragOver ? "true" : "false"}
      >
        <label className={styles.field}>
          Upload a file you already own
          <input
            key={inputKey}
            type="file"
            accept=".txt,.text,.epub,.pdf,text/plain,application/pdf,application/epub+zip"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <p className={styles.hint}>
          {file ? file.name : "Plain text, EPUB, or PDF. Drag a file here, or choose one. 8 MB maximum."}
        </p>
        <button className={styles.primary} type="submit" disabled={!file || busy}>
          {busy ? "Reading the file…" : "Add to library"}
        </button>
        <p className={styles.hint}>
          LOOP READ does not search for or download books. It only reads files you upload, and it keeps the extracted
          text on this server.
        </p>
      </form>

      <div className={styles.toolbar}>
        <h2 style={{ margin: 0 }}>Your files</h2>
        <label className={styles.field}>
          Sort
          <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
            <option value="recent">Recent</option>
            <option value="title">Title</option>
            <option value="finished">Finished</option>
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <p className={styles.note}>No files yet. Add a .txt to try the reader, or an EPUB or PDF that contains real text.</p>
      ) : (
        <ul className={styles.list}>
          {visible.map((book) => {
            const percent = book.wordCount === 0 ? 0 : Math.min(100, Math.round((book.progress / book.wordCount) * 100));
            return (
              <li key={book.id} className={styles.book}>
                <div className={styles.bookTop}>
                  <span className={styles.pill}>{book.format}</span>
                  {book.finishedAt ? <span className={`${styles.pill} ${styles.gold}`}>Loop closed</span> : null}
                </div>
                <h2>{book.title}</h2>
                <p className={styles.hint}>
                  {book.wordCount.toLocaleString()} words
                  {book.finishedAt ? " · finished" : book.progress > 0 ? ` · ${percent}%` : " · not started"}
                </p>
                <div className={styles.inline}>
                  <Link className={styles.primary} href={`/read/${book.id}`}>
                    {book.finishedAt ? "Read again" : book.progress > 0 ? "Resume" : "Read"}
                  </Link>
                  <button type="button" className={styles.danger} onClick={() => void remove(book.id)}>
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
