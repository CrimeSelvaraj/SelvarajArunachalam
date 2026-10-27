"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listJobs, type JobRecord } from "@/lib/jobs";
import styles from "../interior.module.css";

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listJobs()
      .then((data) => {
        if (!cancelled) setJobs(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load jobs");
          setJobs([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} aria-hidden />
      <div className={styles.inner}>
        <p className={styles.kicker}>Recent jobs</p>
        <h1 className={styles.title}>This session</h1>
        <p className={styles.lede}>
          Jobs are stored in-memory on the API process — restart clears the
          list. OpenAlex works and GitHub repos are attached once search finishes.
        </p>

        {error ? <p className={styles.empty}>{error}</p> : null}
        {jobs === null ? (
          <p className={styles.empty}>Loading…</p>
        ) : jobs.length === 0 && !error ? (
          <p className={styles.empty}>
            No jobs yet.{" "}
            <Link href="/" className={styles.link}>
              Generate an article
            </Link>{" "}
            to see discovery candidates here.
          </p>
        ) : (
          <ul className={styles.jobList}>
            {jobs.map((job) => (
              <li key={job.id} className={styles.jobItem}>
                <Link
                  href={job.article_id ? `/a/${job.article_id}` : "/"}
                  className={styles.jobTopic}
                >
                  {job.topic}
                </Link>
                <span className={styles.jobMeta}>
                  {job.status} · {job.stage}
                  {job.sources?.length
                    ? (() => {
                        const works = job.sources.filter(
                          (s) => s.source_type !== "software",
                        ).length;
                        const repos = job.sources.filter(
                          (s) => s.source_type === "software",
                        ).length;
                        return ` · ${works} papers · ${repos} repos`;
                      })()
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className={styles.mutedNote}>
          Tip: use the side menu (Menu) for New article, About, Docs, and
          Settings.
        </p>
      </div>
    </main>
  );
}
