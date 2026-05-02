import type { ChatRequest, SessionInitResponse } from "@ai-support/shared";

export const CHAT_ENDPOINT = "/chat";
export const SESSION_INIT_ENDPOINT = "/session/init";

export async function initSession(product: string): Promise<string> {
  const res = await fetch(SESSION_INIT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product }),
  });
  if (!res.ok) throw new Error(`POST /session/init failed: ${res.status}`);
  const body = (await res.json()) as SessionInitResponse;
  return body.sessionId;
}

export function buildChatInit(
  body: ChatRequest,
  signal?: AbortSignal,
): RequestInit {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal,
  };
}

export function readProductFromUrl(search: string = location.search): string {
  const params = new URLSearchParams(search);
  return params.get("product") ?? "unknown";
}

export interface Suggestion {
  label: string;
  query: string;
}

/**
 * Reads the host-provided suggestion chips from the iframe URL.
 * Loader script's `data-suggestions` attribute is JSON-encoded and
 * forwarded as a query param. Returns an empty array when nothing is
 * configured - the widget falls back to its own no-chip empty state.
 */
export function readSuggestionsFromUrl(
  search: string = location.search,
): Suggestion[] {
  const raw = new URLSearchParams(search).get("suggestions");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is Suggestion =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as Suggestion).label === "string" &&
        typeof (s as Suggestion).query === "string",
    );
  } catch {
    return [];
  }
}
