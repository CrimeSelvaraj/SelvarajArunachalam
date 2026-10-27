"use client";

import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PIPELINE_ORDER,
  STAGE_LABELS,
  createJob,
  getJob,
  type JobRecord,
  type JobStage,
} from "@/lib/jobs";
import styles from "./TopicComposer.module.css";

type Phase = "idle" | "submitting" | "running" | "done" | "error";

function stageIndex(stage: JobStage): number {
  if (stage === "queued") return -1;
  if (stage === "complete") return PIPELINE_ORDER.length;
  if (stage === "failed") return -2;
  return PIPELINE_ORDER.indexOf(stage);
}

export function TopicComposer() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [job, setJob] = useState<JobRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  function stopPolling() {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling(jobId: string) {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      try {
        const next = await getJob(jobId);
        setJob(next);
        if (next.status === "completed") {
          stopPolling();
          setPhase("done");
        } else if (next.status === "failed") {
          stopPolling();
          setPhase("error");
          setError(next.error ?? "Research job failed");
        }
      } catch (err) {
        stopPolling();
        setPhase("error");
        setError(err instanceof Error ? err.message : "Polling failed");
      }
    }, 700);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = topic.trim();
    if (trimmed.length < 3) {
      setError("Enter a topic of at least a few words.");
      setPhase("error");
      return;
    }

    setError(null);
    setPhase("submitting");
    setJob(null);

    try {
      const created = await createJob(trimmed);
      setJob(created);
      setPhase("running");
      startPolling(created.id);
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Could not start research");
    }
  }

  const activeIdx = job ? stageIndex(job.stage) : -1;
  const latestMessage =
    job?.events.length ? job.events[job.events.length - 1].message : null;

  return (
    <div className={styles.composer}>
      <form className={styles.form} onSubmit={onSubmit}>
        <label className={styles.label} htmlFor="topic">
          Research topic
        </label>
        <div className={styles.row}>
          <input
            id="topic"
            name="topic"
            className={styles.input}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. CRISPR base editing in sickle cell disease"
            autoComplete="off"
            disabled={phase === "submitting" || phase === "running"}
            required
            minLength={3}
          />
          <button
            type="submit"
            className={styles.cta}
            disabled={phase === "submitting" || phase === "running" || pending}
          >
            {phase === "submitting" || phase === "running"
              ? "Researching…"
              : "Generate article"}
          </button>
        </div>
      </form>

      {(phase === "running" || phase === "done" || (phase === "error" && job)) && (
        <div className={styles.progress} aria-live="polite">
          <div className={styles.progressMeta}>
            <span className={styles.progressLabel}>
              {phase === "done" ? "Stub complete" : "Research progress"}
            </span>
            <span className={styles.progressPct}>
              {Math.round((job?.progress ?? 0) * 100)}%
            </span>
          </div>
          <div
            className={styles.barTrack}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((job?.progress ?? 0) * 100)}
          >
            <div
              className={styles.barFill}
              style={{ width: `${(job?.progress ?? 0) * 100}%` }}
            />
          </div>
          <ol className={styles.stages}>
            {PIPELINE_ORDER.map((stage, index) => {
              const state =
                activeIdx > index || phase === "done"
                  ? "done"
                  : activeIdx === index
                    ? "active"
                    : "todo";
              return (
                <li key={stage} className={styles.stage} data-state={state}>
                  <span className={styles.stageDot} aria-hidden />
                  <span>{STAGE_LABELS[stage]}</span>
                </li>
              );
            })}
          </ol>
          {latestMessage ? (
            <p className={styles.message}>{latestMessage}</p>
          ) : null}
          {phase === "done" && job?.article_id ? (
            <button
              type="button"
              className={styles.secondary}
              onClick={() =>
                startTransition(() => {
                  router.push(`/a/${job.article_id}`);
                })
              }
            >
              Open article placeholder
            </button>
          ) : null}
        </div>
      )}

      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
