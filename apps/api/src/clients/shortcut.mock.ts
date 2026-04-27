import { randomUUID } from "node:crypto";
import type { TicketDraft, TicketSummary } from "@ai-support/shared";
import type { ShortcutClient } from "./shortcut.js";

/**
 * Mock ShortcutClient. Returns a deterministic-ish fake ticket (new UUID
 * each call but a predictable URL shape) and records every draft it sees
 * in an internal buffer — useful for tests that want to assert what
 * would have been posted to Shortcut.
 */
export interface MockShortcutClient extends ShortcutClient {
  created: TicketDraft[];
  reset(): void;
}

export function createMockShortcutClient(): MockShortcutClient {
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
      return {
        ticketId: id,
        ticketUrl: `https://example.test/tickets/${id}`,
        provider: "mock",
      };
    },
  };
}
