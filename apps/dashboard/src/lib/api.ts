import type { SessionDetail, SessionSummary } from "@ai-support/shared";

export async function fetchSessions(): Promise<SessionSummary[]> {
  const res = await fetch("/sessions");
  if (!res.ok) throw new Error(`GET /sessions failed: ${res.status}`);
  return (await res.json()) as SessionSummary[];
}

export async function fetchSessionDetail(id: string): Promise<SessionDetail> {
  const res = await fetch(`/sessions/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`GET /sessions/${id} failed: ${res.status}`);
  return (await res.json()) as SessionDetail;
}

export interface SystemHealth {
  ok: boolean;
  mode: "live" | "mock";
  shortcut: "live" | "mock";
  github: "live" | "mock";
  demoMode: boolean;
  ragIndexed: number;
}

export async function fetchHealth(): Promise<SystemHealth> {
  const res = await fetch("/health");
  if (!res.ok) throw new Error(`GET /health failed: ${res.status}`);
  return (await res.json()) as SystemHealth;
}
