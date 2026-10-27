export type JobStage =
  | "queued"
  | "search"
  | "screen"
  | "read"
  | "draft"
  | "cite"
  | "complete"
  | "failed";

export type JobStatus = "pending" | "running" | "completed" | "failed";

export type ScreenDecision = "include" | "exclude" | "duplicate";

export type JobOptions = {
  depth?: string;
  include_github?: boolean;
  citation_style?: string;
  screen_max?: number | null;
};

export type JobEvent = {
  stage: JobStage;
  message: string;
  at: string;
  meta?: Record<string, unknown>;
};

export type SourceWork = {
  openalex_id: string;
  doi: string | null;
  title: string;
  authors: string[];
  year: number | null;
  abstract_snippet: string | null;
  is_oa: boolean;
  oa_status: string | null;
  oa_url: string | null;
  pdf_url: string | null;
  landing_url: string | null;
  cited_by_count: number | null;
  source_type: string;
  github_full_name?: string | null;
  html_url?: string | null;
  stars?: number | null;
  license_spdx?: string | null;
  readme_snippet?: string | null;
  citation_cff?: string | null;
  relevance_score?: number | null;
  screen_decision?: ScreenDecision | null;
  screen_rationale?: string | null;
  duplicate_of?: string | null;
  evidence_files?: string[];
};

export type ScreeningSummary = {
  method: string;
  max_include: number;
  included_count: number;
  excluded_count: number;
  duplicate_count: number;
  candidate_count: number;
};

export type EvidenceQuote = {
  id: string;
  source_id: string;
  quote: string;
  summary?: string | null;
  prompt_key?: string | null;
  score?: number | null;
  docname?: string | null;
};

export type EvidenceFinding = {
  key: string;
  question: string;
  answer: string;
  has_successful_answer?: boolean | null;
  quote_ids: string[];
};

export type EvidencePackSummary = {
  status: string;
  method: string;
  directory?: string | null;
  file_count: number;
  pdf_count: number;
  text_count: number;
  source_count: number;
  skip_reason?: string | null;
  findings: EvidenceFinding[];
  quotes: EvidenceQuote[];
};

export function sourceKey(source: SourceWork): string {
  return source.openalex_id || source.github_full_name || source.title;
}

export function isSoftwareSource(source: SourceWork): boolean {
  return source.source_type === "software";
}

export function isIncluded(source: SourceWork): boolean {
  return source.screen_decision === "include";
}

export function isScreenedOut(source: SourceWork): boolean {
  return (
    source.screen_decision === "exclude" ||
    source.screen_decision === "duplicate"
  );
}

export type JobRecord = {
  id: string;
  topic: string;
  options: JobOptions;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  events: JobEvent[];
  sources: SourceWork[];
  screening?: ScreeningSummary | null;
  evidence?: EvidencePackSummary | null;
  article_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export function findingLabel(key: string): string {
  switch (key) {
    case "key_findings":
      return "Key findings";
    case "consensus":
      return "Consensus";
    case "caveats":
      return "Caveats";
    default:
      return key.replace(/_/g, " ");
  }
}

export function sourceById(
  sources: SourceWork[],
  sourceId: string,
): SourceWork | undefined {
  return sources.find((s) => s.openalex_id === sourceId);
}

export function shortSourceTitle(source: SourceWork | undefined, fallback: string): string {
  if (!source) return fallback;
  if (isSoftwareSource(source)) {
    return source.github_full_name || source.title;
  }
  return source.title;
}

const API_BASE = "/api/backend";

export async function createJob(
  topic: string,
  options: JobOptions = {},
): Promise<JobRecord> {
  const body: {
    topic: string;
    options: {
      depth: string;
      include_github: boolean;
      citation_style: string;
      screen_max?: number;
    };
  } = {
    topic,
    options: {
      depth: options.depth ?? "quick",
      include_github: options.include_github ?? true,
      citation_style: options.citation_style ?? "apa",
    },
  };
  if (options.screen_max != null) {
    body.options.screen_max = options.screen_max;
  }
  const res = await fetch(`${API_BASE}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Failed to create job (${res.status})`);
  }
  return res.json();
}

export async function getJob(jobId: string): Promise<JobRecord> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load job (${res.status})`);
  }
  return res.json();
}

export async function listJobs(limit = 20): Promise<JobRecord[]> {
  const res = await fetch(`${API_BASE}/jobs?limit=${limit}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to list jobs (${res.status})`);
  }
  return res.json();
}

export const STAGE_LABELS: Record<JobStage, string> = {
  queued: "Queued",
  search: "Search",
  screen: "Screen",
  read: "Read",
  draft: "Draft",
  cite: "Cite",
  complete: "Complete",
  failed: "Failed",
};

export const PIPELINE_ORDER: JobStage[] = [
  "search",
  "screen",
  "read",
  "draft",
  "cite",
];
