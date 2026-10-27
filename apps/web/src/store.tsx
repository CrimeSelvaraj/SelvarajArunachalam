"use client";

import { useEffect, useSyncExternalStore } from "react";
import { uid } from "@/lib/hash";

const KEY = "atoz.workshop.v1";

export type JobStatus = "queued" | "running" | "review" | "done";

export type Job = {
  id: string;
  title: string;
  studio: string;
  status: JobStatus;
  note: string;
  updatedAt: number;
};

export type Draft = {
  id: string;
  prompt: string;
  featureId: string;
  steps: string[];
  createdAt: number;
};

export type VoteChoice = "left" | "right" | "tie";

export type Vote = {
  id: string;
  prompt: string;
  left: string;
  right: string;
  choice: VoteChoice;
  createdAt: number;
};

export type Score = { wins: number; ties: number; shows: number };

export type VoiceProfile = {
  id: string;
  name: string;
  pitch: number;
  rate: number;
  sample: string;
};

export type Transcript = {
  id: string;
  title: string;
  text: string;
  createdAt: number;
};

export type State = {
  drafts: Draft[];
  jobs: Job[];
  votes: Vote[];
  scores: Record<string, Score>;
  voices: VoiceProfile[];
  transcripts: Transcript[];
  progress: Record<string, boolean>;
};

const STATUSES: JobStatus[] = ["queued", "running", "review", "done"];

const seedJobs: Job[] = [
  {
    id: "job-market-poster",
    title: "Market poster, tide palette",
    studio: "Artcraft",
    status: "review",
    note: "Waiting on a second pass.",
    updatedAt: 1762000000000,
  },
  {
    id: "job-voice-bed",
    title: "Voice bed for the intro",
    studio: "OmniVoice",
    status: "running",
    note: "Profile enrolled on this device.",
    updatedAt: 1762100000000,
  },
];

function createSeed(): State {
  return {
    drafts: [],
    jobs: seedJobs,
    votes: [],
    scores: {},
    voices: [],
    transcripts: [],
    progress: {},
  };
}

const serverState = createSeed();
let memory: State = serverState;
const listeners = new Set<() => void>();
let hydrated = false;

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): State {
  return memory;
}

function getServerSnapshot(): State {
  return serverState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isJob(value: unknown): value is Job {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.studio === "string" &&
    typeof value.note === "string" &&
    STATUSES.includes(value.status as JobStatus)
  );
}

function isDraft(value: unknown): value is Draft {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.prompt === "string" && typeof value.featureId === "string" && Array.isArray(value.steps);
}

function isVote(value: unknown): value is Vote {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.prompt === "string" && (value.choice === "left" || value.choice === "right" || value.choice === "tie");
}

function isVoice(value: unknown): value is VoiceProfile {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.name === "string" && typeof value.sample === "string";
}

function isTranscript(value: unknown): value is Transcript {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.title === "string" && typeof value.text === "string";
}

function asScores(value: unknown): Record<string, Score> {
  if (!isRecord(value)) return {};
  const scores: Record<string, Score> = {};
  for (const [name, raw] of Object.entries(value)) {
    if (!isRecord(raw)) continue;
    scores[name] = { wins: num(raw.wins), ties: num(raw.ties), shows: num(raw.shows) };
  }
  return scores;
}

function asProgress(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) return {};
  const progress: Record<string, boolean> = {};
  for (const [id, done] of Object.entries(value)) {
    if (typeof done === "boolean") progress[id] = done;
  }
  return progress;
}

function merge(base: State, value: unknown): State {
  if (!isRecord(value)) return base;
  const jobs = Array.isArray(value.jobs) ? value.jobs.filter(isJob) : base.jobs;
  return {
    drafts: Array.isArray(value.drafts) ? value.drafts.filter(isDraft) : [],
    jobs,
    votes: Array.isArray(value.votes) ? value.votes.filter(isVote) : [],
    scores: asScores(value.scores),
    voices: Array.isArray(value.voices) ? value.voices.filter(isVoice) : [],
    transcripts: Array.isArray(value.transcripts) ? value.transcripts.filter(isTranscript) : [],
    progress: asProgress(value.progress),
  };
}

function persist(): void {
  localStorage.setItem(KEY, JSON.stringify(memory));
}

export function hydrateStore(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    memory = merge(serverState, JSON.parse(raw) as unknown);
    emit();
  } catch {
    memory = serverState;
  }
}

type Action =
  | { type: "add-draft"; draft: Draft }
  | { type: "remove-draft"; id: string }
  | { type: "add-job"; job: Job }
  | { type: "set-job-status"; id: string; status: JobStatus }
  | { type: "remove-job"; id: string }
  | { type: "add-vote"; vote: Vote }
  | { type: "add-voice"; voice: VoiceProfile }
  | { type: "remove-voice"; id: string }
  | { type: "add-transcript"; transcript: Transcript }
  | { type: "toggle-lesson"; id: string };

function bump(scores: Record<string, Score>, name: string, patch: Partial<Score>): void {
  const current = scores[name] ?? { wins: 0, ties: 0, shows: 0 };
  scores[name] = {
    wins: current.wins + (patch.wins ?? 0),
    ties: current.ties + (patch.ties ?? 0),
    shows: current.shows + (patch.shows ?? 0),
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "add-draft":
      return { ...state, drafts: [action.draft, ...state.drafts].slice(0, 8) };
    case "remove-draft":
      return { ...state, drafts: state.drafts.filter((draft) => draft.id !== action.id) };
    case "add-job":
      return { ...state, jobs: [action.job, ...state.jobs] };
    case "set-job-status":
      return {
        ...state,
        jobs: state.jobs.map((job) =>
          job.id === action.id ? { ...job, status: action.status, updatedAt: Date.now() } : job,
        ),
      };
    case "remove-job":
      return { ...state, jobs: state.jobs.filter((job) => job.id !== action.id) };
    case "add-vote": {
      const scores = { ...state.scores };
      const { vote } = action;
      if (vote.choice === "tie") {
        bump(scores, vote.left, { ties: 1, shows: 1 });
        bump(scores, vote.right, { ties: 1, shows: 1 });
      } else if (vote.choice === "left") {
        bump(scores, vote.left, { wins: 1, shows: 1 });
        bump(scores, vote.right, { shows: 1 });
      } else {
        bump(scores, vote.right, { wins: 1, shows: 1 });
        bump(scores, vote.left, { shows: 1 });
      }
      return { ...state, votes: [vote, ...state.votes].slice(0, 24), scores };
    }
    case "add-voice":
      return { ...state, voices: [action.voice, ...state.voices.filter((voice) => voice.id !== action.voice.id)].slice(0, 6) };
    case "remove-voice":
      return { ...state, voices: state.voices.filter((voice) => voice.id !== action.id) };
    case "add-transcript":
      return { ...state, transcripts: [action.transcript, ...state.transcripts].slice(0, 6) };
    case "toggle-lesson":
      return { ...state, progress: { ...state.progress, [action.id]: !state.progress[action.id] } };
    default:
      return state;
  }
}

export function dispatch(action: Action): void {
  memory = reducer(memory, action);
  if (typeof window !== "undefined") persist();
  emit();
}

export function useStore(): State {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    hydrateStore();
  }, []);
  return state;
}

export function nextStatus(status: JobStatus): JobStatus {
  const index = STATUSES.indexOf(status);
  return STATUSES[(index + 1) % STATUSES.length];
}

export function makeId(prefix: string): string {
  return uid(prefix);
}
