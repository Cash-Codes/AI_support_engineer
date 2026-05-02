import { randomUUID } from "node:crypto";
import type { TicketDraft, TicketSummary } from "@ai-support/shared";
import type { ShortcutClient } from "./shortcut.js";

/**
 * Mock ShortcutClient. Returns a deterministic-ish fake ticket (new UUID
 * each call but a predictable URL shape) and records every draft it sees
 * in an internal buffer - useful for tests that want to assert what
 * would have been posted to Shortcut.
 *
 * When `workspaceSlug` is set, the rendered URL mimics Shortcut's real
 * layout (`https://app.shortcut.com/<slug>/story/<id>`) - useful for
 * screencasts where the mock URL would otherwise read `example.test`.
 */
export interface CreateMockShortcutClientOptions {
  /** Workspace slug used to build a realistic-looking URL. */
  workspaceSlug?: string;
}

export interface MockShortcutClient extends ShortcutClient {
  created: TicketDraft[];
  reset(): void;
}

export function createMockShortcutClient(
  opts: CreateMockShortcutClientOptions = {},
): MockShortcutClient {
  const created: TicketDraft[] = [];
  return {
    mode: "mock",
    created,
    reset() {
      created.length = 0;
    },
    async createStory(draft: TicketDraft): Promise<TicketSummary> {
      created.push(draft);
      const id = `MOCK-${randomUUID().slice(0, 8).toUpperCase()}`;
      const ticketUrl = opts.workspaceSlug
        ? `https://app.shortcut.com/${opts.workspaceSlug}/story/${id}`
        : `https://example.test/tickets/${id}`;
      return {
        ticketId: id,
        ticketUrl,
        provider: "mock",
      };
    },
  };
}
