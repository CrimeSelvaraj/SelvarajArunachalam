"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getJob,
  isIncluded,
  isScreenedOut,
  isSoftwareSource,
  sourceKey,
  type JobRecord,
  type SourceWork,
} from "@/lib/jobs";
import { use } from "react";
import styles from "./page.module.css";

type ArticlePageProps = {
  params: Promise<{ id: string }>;
};

function CandidateItem({ source }: { source: SourceWork }) {
  const software = isSoftwareSource(source);
  const href = software
    ? source.html_url || source.landing_url
    : source.landing_url || source.doi;
  const title = software
    ? source.github_full_name || source.title
    : source.title;
  return (
    <li data-decision={source.screen_decision ?? undefined}>
      <span className={styles.badge} data-kind={software ? "software" : "work"}>
        {software ? "Software" : "Paper"}
      </span>
      {source.screen_decision ? (
        <span
          className={styles.decision}
          data-decision={source.screen_decision}
        >
          {source.screen_decision}
        </span>
      ) : null}
      {href ? (
        <a href={href} target="_blank" rel="noreferrer">
          {title}
        </a>
      ) : (
        title
      )}
      {software && source.stars != null
        ? ` · ★ ${source.stars.toLocaleString()}`
        : ""}
      {source.relevance_score != null
        ? ` · ${Math.round(source.relevance_score * 100)}%`
        : ""}
      {source.screen_rationale ? (
        <span className={styles.reason}>{source.screen_rationale}</span>
      ) : null}
    </li>
  );
}

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

  const included = job?.sources.filter(isIncluded) ?? [];
  const screenedOut = job?.sources.filter(isScreenedOut) ?? [];
  const hasScreening = (job?.sources ?? []).some((s) => s.screen_decision);
  const papers =
    job?.sources.filter((s) => !isSoftwareSource(s) && !hasScreening) ?? [];
  const repos =
    job?.sources.filter((s) => isSoftwareSource(s) && !hasScreening) ?? [];

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} aria-hidden />
      <article className={styles.article}>
        <p className={styles.kicker}>Article placeholder</p>
        <h1 className={styles.title}>
          {job?.topic ?? "Draft arrives in later phases"}
        </h1>
        <p className={styles.body}>
          Job <code className={styles.code}>{id}</code> finished discovery and
          screening. PaperQA evidence packing and the composed narrative land in
          Phases 6–7.
        </p>
        {error ? <p className={styles.body}>{error}</p> : null}
        {job ? (
          <div className={styles.candidates}>
            {job.screening ? (
              <p className={styles.candidateSummary}>
                {job.screening.included_count} included ·{" "}
                {job.screening.excluded_count} excluded ·{" "}
                {job.screening.duplicate_count} duplicates · cap{" "}
                {job.screening.max_include} · {job.screening.method}
              </p>
            ) : (
              <p className={styles.candidateSummary}>
                {papers.length} paper{papers.length === 1 ? "" : "s"} ·{" "}
                {repos.length} software repo{repos.length === 1 ? "" : "s"}
              </p>
            )}
            {hasScreening ? (
              <>
                {included.length > 0 ? (
                  <section>
                    <h2 className={styles.sectionTitle}>
                      Screened in ({included.length})
                    </h2>
                    <ul className={styles.candidateList}>
                      {included.map((s) => (
                        <CandidateItem key={sourceKey(s)} source={s} />
                      ))}
                    </ul>
                  </section>
                ) : null}
                {screenedOut.length > 0 ? (
                  <section>
                    <h2 className={styles.sectionTitle}>
                      Screened out ({screenedOut.length})
                    </h2>
                    <ul className={styles.candidateList}>
                      {screenedOut.map((s) => (
                        <CandidateItem key={sourceKey(s)} source={s} />
                      ))}
                    </ul>
                  </section>
                ) : null}
              </>
            ) : (
              <>
                {papers.length > 0 ? (
                  <section>
                    <h2 className={styles.sectionTitle}>Scholarly works</h2>
                    <ul className={styles.candidateList}>
                      {papers.map((work) => (
                        <CandidateItem key={sourceKey(work)} source={work} />
                      ))}
                    </ul>
                  </section>
                ) : null}
                {repos.length > 0 ? (
                  <section>
                    <h2 className={styles.sectionTitle}>GitHub software</h2>
                    <ul className={styles.candidateList}>
                      {repos.map((repo) => (
                        <CandidateItem key={sourceKey(repo)} source={repo} />
                      ))}
                    </ul>
                  </section>
                ) : null}
              </>
            )}
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
