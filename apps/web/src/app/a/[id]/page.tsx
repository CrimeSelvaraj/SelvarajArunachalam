"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

function citedSources(job: JobRecord): SourceWork[] {
  const included = job.sources.filter(isIncluded);
  const pool = included.length ? included : job.sources;
  const works = pool.filter((s) => !isSoftwareSource(s));
  const software = pool.filter((s) => isSoftwareSource(s));
  return [...works, ...software];
}

export default function ArticlePage({ params }: ArticlePageProps) {
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

  const article = job?.article ?? null;
  const included = job?.sources.filter(isIncluded) ?? [];
  const screenedOut = job?.sources.filter(isScreenedOut) ?? [];
  const hasScreening = (job?.sources ?? []).some((s) => s.screen_decision);
  const refs = useMemo(() => (job ? citedSources(job) : []), [job]);

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} aria-hidden />
      <article className={styles.article}>
        {article ? (
          <>
            <p className={styles.kicker}>
              Scholarly news
              {article.status === "heuristic"
                ? " · heuristic compose"
                : article.status === "ready"
                  ? ` · ${article.method}`
                  : ` · ${article.status}`}
            </p>
            <h1 className={styles.title}>{article.title}</h1>
            {article.skip_reason ? (
              <p className={styles.composeNote}>{article.skip_reason}</p>
            ) : null}
            <div
              className={styles.prose}
              dangerouslySetInnerHTML={{ __html: article.html }}
            />
            {refs.length > 0 ? (
              <nav className={styles.refNav} aria-label="Sources">
                <h2 className={styles.sectionTitle}>Citation markers</h2>
                <ol className={styles.refList}>
                  {refs.map((source, index) => {
                    const n = index + 1;
                    const software = isSoftwareSource(source);
                    const href = software
                      ? source.html_url || source.landing_url
                      : source.landing_url || source.doi;
                    const title = software
                      ? source.github_full_name || source.title
                      : source.title;
                    return (
                      <li key={sourceKey(source)} id={`ref-${n}`}>
                        <span className={styles.refNum}>[{n}]</span>{" "}
                        {href ? (
                          <a href={href} target="_blank" rel="noreferrer">
                            {title}
                          </a>
                        ) : (
                          title
                        )}
                        {source.year ? ` (${source.year})` : ""}
                      </li>
                    );
                  })}
                </ol>
                <p className={styles.citeStub}>
                  Full CSL / BibTeX bibliography polish arrives in Phase 8.
                </p>
              </nav>
            ) : null}
            {article.refused_claims.length > 0 ? (
              <details className={styles.refused}>
                <summary>
                  Refused unsupported / sensational claims (
                  {article.refused_claims.length})
                </summary>
                <ul>
                  {article.refused_claims.map((claim, i) => (
                    <li key={`${i}-${claim.slice(0, 24)}`}>{claim}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        ) : (
          <>
            <p className={styles.kicker}>Article</p>
            <h1 className={styles.title}>
              {job?.topic ?? "Loading article…"}
            </h1>
            <p className={styles.body}>
              Job <code className={styles.code}>{id}</code>
              {job?.status === "completed"
                ? " finished without a composed article."
                : job
                  ? ` is ${job.status} (${job.stage}).`
                  : " — fetching…"}
            </p>
          </>
        )}
        {error ? <p className={styles.body}>{error}</p> : null}

        {job && hasScreening ? (
          <div className={styles.candidates}>
            {job.screening ? (
              <p className={styles.candidateSummary}>
                {job.screening.included_count} included ·{" "}
                {job.screening.excluded_count} excluded ·{" "}
                {job.screening.duplicate_count} duplicates ·{" "}
                {article
                  ? `${article.claims.length} claims`
                  : "awaiting compose"}
              </p>
            ) : null}
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
          </div>
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
