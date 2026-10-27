"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BASE_WPM, chunkSize, SPEEDS, wpmFor, type ChunkMode, type SpeedId } from "@/lib/words";
import { FlashWord } from "./FlashWord";
import styles from "./reader.module.css";

type Badge = { name: string; bookTitle: string };

export function SpeedReader({
  kicker,
  title,
  words,
  initialIndex = 0,
  bookId,
  alreadyFinished = false,
}: {
  kicker: string;
  title: string;
  words: string[];
  initialIndex?: number;
  bookId?: string;
  alreadyFinished?: boolean;
}) {
  const starting = Math.min(Math.max(initialIndex, 0), words.length);
  const [index, setIndex] = useState(starting);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(starting >= words.length && words.length > 0);
  const [speed, setSpeed] = useState<SpeedId>("1.5");
  const [mode, setMode] = useState<ChunkMode>("one");
  const [award, setAward] = useState<Badge | null>(null);
  const [again, setAgain] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const indexRef = useRef(starting);
  const modeRef = useRef(mode);
  const wpmRef = useRef(wpmFor(speed));
  const saveTimer = useRef(0);
  const finishing = useRef(false);
  modeRef.current = mode;
  wpmRef.current = wpmFor(speed);

  useEffect(() => {
    if (!playing || words.length === 0) return;
    let timer = 0;
    let cancelled = false;

    const schedule = () => {
      const current = indexRef.current;
      if (current >= words.length) {
        setPlaying(false);
        setDone(true);
        void finish();
        return;
      }
      const size = chunkSize(modeRef.current);
      const next = Math.min(words.length, current + size);
      const delay = Math.max(50, Math.round(((next - current) / wpmRef.current) * 60_000));
      timer = window.setTimeout(() => {
        if (cancelled) return;
        indexRef.current = next;
        setIndex(next);
        queueProgress(next);
        schedule();
      }, delay);
    };

    schedule();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // finish and queueProgress are stable enough via refs; speed/mode restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, mode, speed, words.length]);

  useEffect(() => {
    function onHide() {
      if (document.hidden) setPlaying(false);
    }
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLButtonElement
      ) {
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        toggle();
      }
    }
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function queueProgress(next: number) {
    if (!bookId) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void persist(next);
    }, 300);
  }

  async function persist(next: number) {
    if (!bookId) return;
    const res = await fetch(`/api/library/${bookId}/progress`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index: next }),
    });
    if (res.status === 401) {
      const data = (await res.json().catch(() => null)) as { reason?: string } | null;
      setPlaying(false);
      if (data?.reason === "replaced") setSessionEnded(true);
    }
  }

  async function finish() {
    if (!bookId || finishing.current) {
      return;
    }
    finishing.current = true;
    const res = await fetch(`/api/library/${bookId}/finish`, { method: "POST" });
    const data = (await res.json().catch(() => null)) as {
      newlyAwarded?: boolean;
      badge?: Badge;
      reason?: string;
      error?: string;
    } | null;
    if (res.status === 401 && data?.reason === "replaced") {
      setSessionEnded(true);
      return;
    }
    if (!res.ok) {
      finishing.current = false;
      setError(data?.error || "The badge could not be saved.");
      return;
    }
    if (data?.newlyAwarded && data.badge) setAward(data.badge);
    else if (alreadyFinished || data?.badge) setAgain(true);
  }

  function toggle() {
    if (sessionEnded || words.length === 0) return;
    if (indexRef.current >= words.length) {
      replay();
      return;
    }
    setPlaying((value) => !value);
  }

  function replay() {
    finishing.current = false;
    indexRef.current = 0;
    setIndex(0);
    setDone(false);
    setAgain(false);
    setAward(null);
    setPlaying(true);
    queueProgress(0);
  }

  function restart() {
    setPlaying(false);
    finishing.current = false;
    indexRef.current = 0;
    setIndex(0);
    setDone(false);
    setAgain(false);
    queueProgress(0);
  }

  const wpm = wpmFor(speed);
  const size = chunkSize(mode);
  const atEnd = index >= words.length;
  const start = atEnd ? Math.max(0, words.length - size) : index;
  const chunk = words.slice(start, Math.min(words.length, start + size));
  const shown = Math.min(index, words.length);
  const progress = words.length === 0 ? 0 : Math.round((shown / words.length) * 100);
  const mid = Math.floor((chunk.length - 1) / 2);
  const buttonLabel = playing ? "Pause" : atEnd ? "Read again" : index > 0 ? "Resume" : "Start";

  return (
    <section className={styles.wrap}>
      <div>
        <p className={styles.kicker}>{kicker}</p>
        <h1 className={styles.title}>{title}</h1>
      </div>

      {sessionEnded ? (
        <p className={styles.banner} role="status">
          This session ended because the email signed in on another device.{" "}
          <Link href="/login?reason=replaced">Sign in again</Link>
        </p>
      ) : null}
      {error ? (
        <p className={styles.banner} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.stage} aria-live="off">
        {chunk.length > 0 ? (
          <p className={styles.chunk} data-count={chunk.length}>
            {chunk.map((word, wordIndex) => (
              <FlashWord key={`${start}-${wordIndex}`} word={word} emphasize={wordIndex === mid} />
            ))}
          </p>
        ) : (
          <p>No words to flash.</p>
        )}
      </div>

      <div className={styles.track} role="progressbar" aria-valuemin={0} aria-valuemax={words.length} aria-valuenow={shown}>
        <div className={styles.bar} style={{ width: `${progress}%` }} />
      </div>
      <p className={styles.meta}>
        {shown.toLocaleString()} / {words.length.toLocaleString()} words · {progress}%
      </p>

      <div className={styles.controls}>
        <label className={styles.field}>
          Pace
          <select
            value={speed}
            onChange={(event) => setSpeed(event.target.value as SpeedId)}
          >
            {SPEEDS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} · {option.wpm} WPM
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Flash
          <select value={mode} onChange={(event) => setMode(event.target.value as ChunkMode)}>
            <option value="one">One word</option>
            <option value="two">Two words</option>
            <option value="group">Short group</option>
          </select>
        </label>
        <p className={styles.wpm}>
          {wpm}
          <span>words per minute</span>
        </p>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={toggle} disabled={words.length === 0 || sessionEnded}>
          {buttonLabel}
        </button>
        <button type="button" className={styles.ghost} onClick={restart} disabled={words.length === 0}>
          Start over
        </button>
        {bookId ? (
          <Link href="/library">Back to library</Link>
        ) : (
          <Link href="/library">Open library</Link>
        )}
      </div>
      <p className={styles.hint}>
        Space starts and pauses. The yellow letter is the anchor for your eyes. 1× would be {BASE_WPM} words per minute;
        the pace menu multiplies that.
      </p>

      {done && !bookId ? (
        <div className={styles.award} role="status">
          <p className={styles.kicker}>Sample</p>
          <h2>Drill complete</h2>
          <p>You moved through {words.length} sample words at {wpm} words per minute.</p>
        </div>
      ) : null}

      {award ? (
        <div className={styles.award} role="status">
          <p className={styles.kicker}>Badge</p>
          <h2>{award.name}</h2>
          <p>You finished {award.bookTitle}.</p>
          <Link href="/badges">See badges</Link>
        </div>
      ) : null}

      {alreadyFinished && done && !award && !again ? (
        <div className={styles.award} role="status">
          <p className={styles.kicker}>Badge</p>
          <h2>Loop closed</h2>
          <p>You already finished this book.</p>
          <Link href="/badges">See badges</Link>
        </div>
      ) : null}

      {again && !award ? (
        <div className={styles.award} role="status">
          <h2>You reached the end again</h2>
          <p>The badge for this book is already in your collection.</p>
          <Link href="/badges">See badges</Link>
        </div>
      ) : null}
    </section>
  );
}
