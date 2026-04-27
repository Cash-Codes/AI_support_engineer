import type { TicketDraft, TicketSummary } from "@ai-support/shared";
import type { Logger } from "../logger.js";

/**
 * ShortcutClient creates a support ticket from a TicketDraft. Live and
 * mock implementations share this shape so the ticketing phase does not
 * need to know which one is wired up.
 */
export interface ShortcutClient {
  createStory(draft: TicketDraft): Promise<TicketSummary>;
  mode: "live" | "mock";
}

export interface CreateLiveShortcutClientOptions {
  apiToken: string;
  /** Required by most Shortcut workspaces — optional here with a clear error. */
  workflowStateId?: number;
  /** Base URL override (for tests); defaults to production. */
  apiBase?: string;
  /** 5s default keeps the pipeline snappy; live failures fall back gracefully. */
  timeoutMs?: number;
  logger?: Logger;
  fetchImpl?: typeof fetch;
}

const DEFAULT_API_BASE = "https://api.app.shortcut.com/api/v3";
const DEFAULT_TIMEOUT_MS = 5_000;

interface ShortcutStoryResponse {
  id: number;
  app_url: string;
}

/**
 * Live Shortcut client — POSTs to /api/v3/stories with the
 * `Shortcut-Token` header. Throws on network / auth / 4xx-5xx failures
 * so the orchestrator surfaces `ticketing: failed` and the rest of the
 * pipeline continues.
 */
export function createLiveShortcutClient(
  opts: CreateLiveShortcutClientOptions,
): ShortcutClient {
  const apiBase = opts.apiBase ?? DEFAULT_API_BASE;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch = opts.fetchImpl ?? fetch;

  return {
    mode: "live",
    async createStory(draft: TicketDraft): Promise<TicketSummary> {
      const body: Record<string, unknown> = {
        name: draft.title,
        description: draft.body,
        story_type: draft.storyType,
        labels: draft.labels.map((name) => ({ name })),
      };
      if (opts.workflowStateId !== undefined) {
        body.workflow_state_id = opts.workflowStateId;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await doFetch(`${apiBase}/stories`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Shortcut-Token": opts.apiToken,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`shortcut ${res.status}: ${text.slice(0, 240)}`);
        }
        const json = (await res.json()) as Partial<ShortcutStoryResponse>;
        if (!json.id || !json.app_url) {
          throw new Error(
            "shortcut: response missing id or app_url — API contract changed?",
          );
        }
        opts.logger?.info(
          { ticketId: json.id, ticketUrl: json.app_url },
          "shortcut: story created",
        );
        return {
          ticketId: String(json.id),
          ticketUrl: json.app_url,
          provider: "shortcut",
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
