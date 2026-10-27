import { useSyncExternalStore } from "react";

const KEY = "atoz.incoming-prompt";
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function stashPrompt(prompt: string): void {
  sessionStorage.setItem(KEY, prompt);
  emit();
}

export function peekPrompt(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(KEY) ?? "";
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emptyPrompt(): string {
  return "";
}

export function useIncomingPrompt(): string {
  return useSyncExternalStore(subscribe, peekPrompt, emptyPrompt);
}
