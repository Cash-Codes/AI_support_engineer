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
