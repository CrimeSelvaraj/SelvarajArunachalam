"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getJob,
  isSoftwareSource,
  sourceKey,
  type JobRecord,
} from "@/lib/jobs";
import { use } from "react";
import styles from "./page.module.css";

type ArticlePageProps = {
  params: Promise<{ id: string }>;
};

export default function ArticlePlaceholderPage({ params }: ArticlePageProps) {
  const { id } = use(params);
  const [job, setJob] = useState<JobRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getJob(id)
      .then((data) => {
        if (!cancelled) setJob(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load job");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const papers = job?.sources.filter((s) => !isSoftwareSource(s)) ?? [];
  const repos = job?.sources.filter((s) => isSoftwareSource(s)) ?? [];

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} aria-hidden />
      <article className={styles.article}>
        <p className={styles.kicker}>Article placeholder</p>
        <h1 className={styles.title}>
          {job?.topic ?? "Draft arrives in later phases"}
        </h1>
        <p className={styles.body}>
          Job <code className={styles.code}>{id}</code> finished discovery
          (OpenAlex works + optional GitHub software). Screening, evidence
          packing, and the composed narrative land in Phases 5–7.
        </p>
        {error ? <p className={styles.body}>{error}</p> : null}
        {job ? (
          <div className={styles.candidates}>
            <p className={styles.candidateSummary}>
              {papers.length} paper{papers.length === 1 ? "" : "s"} ·{" "}
              {repos.length} software repo{repos.length === 1 ? "" : "s"}
            </p>
            {papers.length > 0 ? (
              <section>
                <h2 className={styles.sectionTitle}>Scholarly works</h2>
                <ul className={styles.candidateList}>
                  {papers.map((work) => (
                    <li key={sourceKey(work)}>
                      <span className={styles.badge} data-kind="work">
                        Paper
                      </span>{" "}
                      {work.landing_url || work.doi ? (
                        <a
                          href={work.landing_url || work.doi || undefined}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {work.title}
                        </a>
                      ) : (
                        work.title
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {repos.length > 0 ? (
              <section>
                <h2 className={styles.sectionTitle}>GitHub software</h2>
                <ul className={styles.candidateList}>
                  {repos.map((repo) => (
                    <li key={sourceKey(repo)}>
                      <span className={styles.badge} data-kind="software">
                        Software
                      </span>{" "}
                      {repo.html_url || repo.landing_url ? (
                        <a
                          href={
                            repo.html_url || repo.landing_url || undefined
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          {repo.github_full_name || repo.title}
                        </a>
                      ) : (
                        repo.github_full_name || repo.title
                      )}
                      {repo.stars != null
                        ? ` · ★ ${repo.stars.toLocaleString()}`
                        : ""}
                      {repo.license_spdx ? ` · ${repo.license_spdx}` : ""}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : !error ? (
          <p className={styles.body}>Loading candidates…</p>
        ) : null}
        <div className={styles.actions}>
          <Link href="/" className={styles.back}>
            ← Start another topic
          </Link>
          <Link href="/jobs" className={styles.back}>
            Recent jobs
          </Link>
        </div>
      </article>
    </main>
  );
}
