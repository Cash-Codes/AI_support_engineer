import type {
  ChatMessage,
  PipelineTrace,
  TicketSummary,
} from "@ai-support/shared";
import { describe, expect, it } from "vitest";
import { SessionStore } from "./store.js";

const message = (id: string, content: string): ChatMessage => ({
  id,
  role: "user",
  content,
  createdAt: new Date().toISOString(),
});

const trace = (confidence: "low" | "medium" | "high"): PipelineTrace => ({
  events: [],
  retrievedDocs: [],
  confidence,
});

const ticket = (id: string): TicketSummary => ({
  ticketId: id,
  ticketUrl: `https://example.test/t/${id}`,
  provider: "mock",
});

describe("SessionStore", () => {
  it("creates a session with the given product and no messages", () => {
    const store = new SessionStore();
    const s = store.create("acme-app");
    expect(s.product).toBe("acme-app");
    expect(s.messageCount).toBe(0);
    expect(s.hasTicket).toBe(false);
    expect(store.has(s.sessionId)).toBe(true);
  });

  it("records messages, traces, tickets, and reflects them in detail + summary", () => {
    const store = new SessionStore();
    const s = store.create("acme-app");
    store.appendMessage(s.sessionId, message("m1", "hi"));
    store.appendTrace(s.sessionId, trace("high"));
    store.appendTicket(s.sessionId, ticket("T-1"));

    const detail = store.getDetail(s.sessionId);
    expect(detail?.messages).toHaveLength(1);
    expect(detail?.traces).toHaveLength(1);
    expect(detail?.tickets).toHaveLength(1);
    expect(detail?.summary.messageCount).toBe(1);
    expect(detail?.summary.latestConfidence).toBe("high");
    expect(detail?.summary.hasTicket).toBe(true);
  });

  it("list() returns newest first", async () => {
    const store = new SessionStore();
    const a = store.create("a");
    await new Promise((r) => setTimeout(r, 5));
    const b = store.create("b");
    const list = store.list();
    expect(list[0].sessionId).toBe(b.sessionId);
    expect(list[1].sessionId).toBe(a.sessionId);
  });

  it("evicts oldest entries when the cap is exceeded", () => {
    const store = new SessionStore(2);
    const a = store.create("a");
    store.create("b");
    store.create("c");
    expect(store.size()).toBe(2);
    expect(store.has(a.sessionId)).toBe(false);
  });
});
