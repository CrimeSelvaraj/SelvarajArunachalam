"use client";

import { useState } from "react";
import { Bench, Notice, usePhase } from "@/components/ui";
import { features, groupLabel, mustFeature } from "@/features";
import { formatDay, uid } from "@/lib/hash";
import { dispatch, nextStatus, useStore, type JobStatus } from "@/store";

const filters: Array<JobStatus | "all"> = ["all", "queued", "running", "review", "done"];

export function Services() {
  const feature = mustFeature("services");
  const { jobs } = useStore();
  const studios = features.filter((item) => item.group === "studios" || item.id === "omnivoice" || item.id === "heygem");
  const [title, setTitle] = useState("");
  const [studio, setStudio] = useState("Artcraft");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<JobStatus | "all">("all");
  const [freshId, setFreshId] = useState("");
  const { phase, message, run } = usePhase();
  const visible = jobs.filter((job) => filter === "all" || job.status === filter);

  async function addJob(event: React.FormEvent) {
    event.preventDefault();
    await run(async () => {
      const nextTitle = title.trim();
      if (nextTitle.length < 3) throw new Error("Name the job so the board can show it.");
      const id = uid("job");
      dispatch({
        type: "add-job",
        job: {
          id,
          title: nextTitle,
          studio,
          status: "queued",
          note: note.trim(),
          updatedAt: Date.now(),
        },
      });
      setFreshId(id);
      setTitle("");
      setNote("");
      setFilter("all");
    });
  }

  return (
    <Bench
      kicker={groupLabel(feature.group)}
      title={feature.name}
      lede={feature.summary}
      layout="stack"
      result={
        <div className="stack-gap">
          {phase === "loading" ? <Notice tone="loading" title="Adding the job">It will show at the top of the list.</Notice> : null}
          {phase === "error" ? <Notice tone="error" title="Needs a fix">{message}</Notice> : null}
          {phase === "ready" ? <p className="kicker">Job added.</p> : null}
          <div className="choice-row">
            {filters.map((item) => (
              <button key={item} type="button" className="choice" aria-pressed={filter === item} onClick={() => setFilter(item)}>
                {item}
              </button>
            ))}
          </div>
          {jobs.length === 0 ? (
            <Notice tone="empty" title="No jobs on the board">Add one with the form.</Notice>
          ) : visible.length === 0 ? (
            <Notice tone="empty" title={`Nothing in ${filter}`}>Try another status, or add a job.</Notice>
          ) : (
            <ul className="draft-list">
              {visible.map((job) => (
                <li key={job.id} className={job.id === freshId ? "job-fresh" : undefined}>
                  <div>
                    <strong>{job.title}</strong>
                    <p>
                      {job.studio} · <span className={`status status-${job.status}`}>{job.status}</span> · {formatDay(job.updatedAt)}
                    </p>
                    {job.note ? <p>{job.note}</p> : null}
                  </div>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => dispatch({ type: "set-job-status", id: job.id, status: nextStatus(job.status) })}
                    >
                      {job.status === "done" ? "Requeue" : "Advance"}
                    </button>
                    <button type="button" className="btn quiet" onClick={() => dispatch({ type: "remove-job", id: job.id })}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      }
    >
      <form onSubmit={(event) => void addJob(event)}>
        <label className="field">
          <span>Job title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Window card for the repair cafe" />
        </label>
        <label className="field">
          <span>Studio</span>
          <select value={studio} onChange={(event) => setStudio(event.target.value)}>
            {studios.map((item) => (
              <option key={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Note</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
        </label>
        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={phase === "loading"}>
            {phase === "loading" ? "Working…" : "Add job"}
          </button>
        </div>
      </form>
    </Bench>
  );
}
