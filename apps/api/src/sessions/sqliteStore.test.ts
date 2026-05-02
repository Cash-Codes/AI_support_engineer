import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  ChatMessage,
  PRSummary,
  PipelineTrace,
  TicketSummary,
} from "@ai-support/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteSessionStore } from "./sqliteStore.js";

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

const pr = (branch: string): PRSummary => ({
  branch,
  prUrl: `https://example.test/pr/${branch}`,
  provider: "mock",
});

let store: SqliteSessionStore;

beforeEach(() => {
  store = new SqliteSessionStore({ dbPath: ":memory:" });
});

afterEach(() => {
  store.close();
});

describe("SqliteSessionStore", () => {
  it("creates a session, persists and reflects it in the summary", () => {
    const s = store.create("acme-app");
    expect(s.product).toBe("acme-app");
    expect(s.messageCount).toBe(0);
    expect(s.hasTicket).toBe(false);
    expect(s.hasPR).toBe(false);
    expect(store.has(s.sessionId)).toBe(true);
  });

  it("records messages, traces, tickets, prs and surfaces them in detail", () => {
    const s = store.create("acme");
    store.appendMessage(s.sessionId, message("m1", "hi"));
    store.appendMessage(s.sessionId, message("m2", "second"));
    store.appendTrace(s.sessionId, trace("medium"));
    store.appendTrace(s.sessionId, trace("high"));
    store.appendTicket(s.sessionId, ticket("T-1"));
    store.appendPR(s.sessionId, pr("fix/x"));

    const detail = store.getDetail(s.sessionId);
    expect(detail).toBeDefined();
    expect(detail?.messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(detail?.traces).toHaveLength(2);
    expect(detail?.tickets[0].ticketId).toBe("T-1");
    expect(detail?.prs[0].branch).toBe("fix/x");
    // summary reflects latest trace's confidence + boolean flags
    expect(detail?.summary.messageCount).toBe(2);
    expect(detail?.summary.latestConfidence).toBe("high");
    expect(detail?.summary.hasTicket).toBe(true);
    expect(detail?.summary.hasPR).toBe(true);
  });

  it("list() returns newest-first up to limit", async () => {
    const a = store.create("a");
    await new Promise((r) => setTimeout(r, 5));
    const b = store.create("b");
    const list = store.list();
    expect(list[0].sessionId).toBe(b.sessionId);
    expect(list[1].sessionId).toBe(a.sessionId);
  });

  it("evicts oldest sessions when the cap is exceeded", () => {
    const small = new SqliteSessionStore({
      dbPath: ":memory:",
      maxSessions: 2,
    });
    try {
      const a = small.create("a");
      small.create("b");
      small.create("c");
      expect(small.size()).toBe(2);
      expect(small.has(a.sessionId)).toBe(false);
    } finally {
      small.close();
    }
  });

  it("throws on append to a missing session", () => {
    expect(() =>
      store.appendMessage("does-not-exist", message("m", "x")),
    ).toThrow(/session not found/);
  });

  it("getDetail returns undefined for unknown id", () => {
    expect(store.getDetail("nope")).toBeUndefined();
  });

  it("persists across reopen of the same db file", () => {
    const tmp = path.join(os.tmpdir(), `sqlite-store-test-${Date.now()}.db`);
    const s1 = new SqliteSessionStore({ dbPath: tmp });
    const created = s1.create("persistent");
    s1.appendMessage(created.sessionId, message("m1", "before restart"));
    s1.close();

    const s2 = new SqliteSessionStore({ dbPath: tmp });
    try {
      expect(s2.has(created.sessionId)).toBe(true);
      const detail = s2.getDetail(created.sessionId);
      expect(detail?.messages[0].content).toBe("before restart");
    } finally {
      s2.close();
      // SQLite WAL mode leaves -wal/-shm sidecar files; clean them up.
      for (const suffix of ["", "-wal", "-shm"]) {
        try {
          fs.unlinkSync(`${tmp}${suffix}`);
        } catch {
          // ignore - file may not exist
        }
      }
    }
  });
});
