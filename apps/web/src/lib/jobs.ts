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

export type JobOptions = {
  depth?: string;
  include_github?: boolean;
  citation_style?: string;
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
};

export type JobRecord = {
  id: string;
  topic: string;
  options: JobOptions;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  events: JobEvent[];
  sources: SourceWork[];
  article_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

const API_BASE = "/api/backend";

export async function createJob(
  topic: string,
  options: JobOptions = {},
): Promise<JobRecord> {
  const res = await fetch(`${API_BASE}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      options: {
        depth: options.depth ?? "quick",
        include_github: options.include_github ?? true,
        citation_style: options.citation_style ?? "apa",
      },
    }),
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
