"use client";

import { useState, type ReactNode } from "react";
import { wait } from "@/lib/hash";

export type Phase = "empty" | "loading" | "error" | "ready";

export function Notice({
  tone,
  title,
  children,
}: {
  tone: "loading" | "error" | "empty";
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={`notice ${tone}`} role={tone === "error" ? "alert" : "status"}>
      {tone === "loading" ? <span className="spinner" aria-hidden="true" /> : null}
      <div>
        <strong>{title}</strong>
        {children ? <p>{children}</p> : null}
      </div>
    </div>
  );
}

export function ResultSlot({
  phase,
  message,
  emptyTitle,
  emptyBody,
  children,
}: {
  phase: Phase;
  message: string;
  emptyTitle: string;
  emptyBody: string;
  children: ReactNode;
}) {
  if (phase === "loading") {
    return <Notice tone="loading" title="Working on it">This stays in the browser.</Notice>;
  }
  if (phase === "error") {
    return <Notice tone="error" title="Needs a fix">{message}</Notice>;
  }
  if (phase === "empty") {
    return <Notice tone="empty" title={emptyTitle}>{emptyBody}</Notice>;
  }
  return <>{children}</>;
}

export function Bench({
  kicker,
  title,
  lede,
  layout = "split",
  children,
  result,
}: {
  kicker: string;
  title: string;
  lede: string;
  layout?: "split" | "stack";
  children: ReactNode;
  result: ReactNode;
}) {
  return (
    <article className="page">
      <header className="page-head">
        <p className="kicker">{kicker}</p>
        <h1>{title}</h1>
        <p className="lede">{lede}</p>
      </header>
      <div className={layout === "stack" ? "stack" : "split"}>
        <section className="panel form-panel">{children}</section>
        <section className="panel result-panel">
          <h2>Result</h2>
          {result}
        </section>
      </div>
    </article>
  );
}

export function Slider({
  label,
  min,
  max,
  value,
  onChange,
  unit = "",
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
}) {
  return (
    <label className="field">
      <span>
        {label} <strong>{value}{unit}</strong>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

export function Choices({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="field">
      <legend>{label}</legend>
      <div className="choice-row">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="choice"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function usePhase() {
  const [phase, setPhase] = useState<Phase>("empty");
  const [message, setMessage] = useState("");

  async function run(task: () => Promise<void> | void) {
    setPhase("loading");
    setMessage("");
    try {
      await task();
      setPhase("ready");
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  function clear() {
    setPhase("empty");
    setMessage("");
  }

  return { phase, message, run, clear, setPhase, setMessage };
}

export async function pause(ms = 420): Promise<void> {
  await wait(ms);
}
