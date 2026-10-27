"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  bibliographyBibUrl,
  bibliographyCslUrl,
  getJob,
  isIncluded,
  isScreenedOut,
  isSoftwareSource,
  sourceKey,
  type BibliographyEntry,
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

/** Fallback when bibliography stage has not run yet (legacy jobs). */
function citedSourcesFallback(job: JobRecord): SourceWork[] {
  const included = job.sources.filter(isIncluded);
  const pool = included.length ? included : job.sources;
  const works = pool.filter((s) => !isSoftwareSource(s));
  const software = pool.filter((s) => isSoftwareSource(s));
  return [...works, ...software];
}

function BibliographyFooter({
  entries,
  style,
  jobId,
}: {
  entries: BibliographyEntry[];
  style: string;
  jobId: string;
}) {
  const styleLabel = style.toUpperCase() === "APA" ? "APA" : style.toUpperCase();
  return (
    <nav className={styles.refNav} aria-label="Bibliography">
      <h2 className={styles.sectionTitle}>References ({styleLabel})</h2>
      <ol className={styles.refList}>
        {entries.map((entry) => (
          <li key={entry.citekey} id={`ref-${entry.n}`}>
            <span className={styles.refNum}>[{entry.n}]</span>{" "}
            <code className={styles.citekey}>{entry.citekey}</code>{" "}
            <span className={styles.apa}>{entry.apa}</span>
          </li>
        ))}
      </ol>
      <div className={styles.exportRow}>
        <a
          className={styles.exportLink}
          href={bibliographyBibUrl(jobId)}
          download
        >
          Download BibTeX
        </a>
        <a
          className={styles.exportLink}
          href={bibliographyCslUrl(jobId)}
          download
        >
          Download CSL-JSON
        </a>
      </div>
    </nav>
  );
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
  const bibliography = job?.bibliography ?? null;
  const included = job?.sources.filter(isIncluded) ?? [];
  const screenedOut = job?.sources.filter(isScreenedOut) ?? [];
  const hasScreening = (job?.sources ?? []).some((s) => s.screen_decision);
  const fallbackRefs = useMemo(
    () => (job && !bibliography?.entries.length ? citedSourcesFallback(job) : []),
    [job, bibliography],
  );

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
              {bibliography
                ? ` · ${bibliography.entries.length} refs`
                : ""}
            </p>
            <h1 className={styles.title}>{article.title}</h1>
            {article.skip_reason ? (
              <p className={styles.composeNote}>{article.skip_reason}</p>
            ) : null}
            <div
              className={styles.prose}
              dangerouslySetInnerHTML={{ __html: article.html }}
            />
            {bibliography && bibliography.entries.length > 0 ? (
              <BibliographyFooter
                entries={bibliography.entries}
                style={bibliography.style}
                jobId={id}
              />
            ) : fallbackRefs.length > 0 ? (
              <nav className={styles.refNav} aria-label="Sources">
                <h2 className={styles.sectionTitle}>Citation markers</h2>
                <ol className={styles.refList}>
                  {fallbackRefs.map((source, index) => {
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
                {bibliography
                  ? ` · ${bibliography.entries.length} bibliography`
                  : ""}
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
