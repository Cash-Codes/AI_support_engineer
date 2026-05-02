import { randomUUID } from "node:crypto";
import type {
  ChatMessage,
  PRSummary,
  PipelineTrace,
  SessionDetail,
  SessionSummary,
  TicketSummary,
} from "@ai-support/shared";

/**
 * SessionStore is the persistence boundary for chat sessions. The api
 * orchestrator calls these methods; the choice of in-memory vs SQLite
 * (or anything else later) is made at server boot.
 */
export interface SessionStore {
  create(product: string): SessionSummary;
  has(sessionId: string): boolean;
  appendMessage(sessionId: string, message: ChatMessage): void;
  appendTrace(sessionId: string, trace: PipelineTrace): void;
  appendTicket(sessionId: string, ticket: TicketSummary): void;
  appendPR(sessionId: string, pr: PRSummary): void;
  list(limit?: number): SessionSummary[];
  getDetail(sessionId: string): SessionDetail | undefined;
  size(): number;
}

interface SessionRecord {
  sessionId: string;
  product: string;
  createdAt: string;
  lastActivityAt: string;
  messages: ChatMessage[];
  traces: PipelineTrace[];
  tickets: TicketSummary[];
  prs: PRSummary[];
}

export const DEFAULT_MAX_SESSIONS = 500;

/** In-memory `SessionStore` - fast, ephemeral, used for tests + dev w/o persistence. */
export class InMemorySessionStore implements SessionStore {
  private readonly records = new Map<string, SessionRecord>();
  private readonly maxSessions: number;

  constructor(maxSessions: number = DEFAULT_MAX_SESSIONS) {
    this.maxSessions = maxSessions;
  }

  create(product: string): SessionSummary {
    const now = new Date().toISOString();
    const sessionId = randomUUID();
    const record: SessionRecord = {
      sessionId,
      product,
      createdAt: now,
      lastActivityAt: now,
      messages: [],
      traces: [],
      tickets: [],
      prs: [],
    };
    this.records.set(sessionId, record);
    this.evictIfNeeded();
    return this.summarize(record);
  }

  has(sessionId: string): boolean {
    return this.records.has(sessionId);
  }

  appendMessage(sessionId: string, message: ChatMessage): void {
    const rec = this.mustGet(sessionId);
    rec.messages.push(message);
    rec.lastActivityAt = new Date().toISOString();
  }

  appendTrace(sessionId: string, trace: PipelineTrace): void {
    const rec = this.mustGet(sessionId);
    rec.traces.push(trace);
    rec.lastActivityAt = new Date().toISOString();
  }

  appendTicket(sessionId: string, ticket: TicketSummary): void {
    const rec = this.mustGet(sessionId);
    rec.tickets.push(ticket);
    rec.lastActivityAt = new Date().toISOString();
  }

  appendPR(sessionId: string, pr: PRSummary): void {
    const rec = this.mustGet(sessionId);
    rec.prs.push(pr);
    rec.lastActivityAt = new Date().toISOString();
  }

  list(limit = 50): SessionSummary[] {
    return Array.from(this.records.values())
      .sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1))
      .slice(0, limit)
      .map((r) => this.summarize(r));
  }

  getDetail(sessionId: string): SessionDetail | undefined {
    const rec = this.records.get(sessionId);
    if (!rec) return undefined;
    return {
      summary: this.summarize(rec),
      messages: [...rec.messages],
      traces: [...rec.traces],
      tickets: [...rec.tickets],
      prs: [...rec.prs],
    };
  }

  size(): number {
    return this.records.size;
  }

  private mustGet(sessionId: string): SessionRecord {
    const rec = this.records.get(sessionId);
    if (!rec) throw new Error(`session not found: ${sessionId}`);
    return rec;
  }

  private summarize(r: SessionRecord): SessionSummary {
    const latestTrace = r.traces[r.traces.length - 1];
    return {
      sessionId: r.sessionId,
      product: r.product,
      createdAt: r.createdAt,
      lastActivityAt: r.lastActivityAt,
      messageCount: r.messages.length,
      latestConfidence: latestTrace?.confidence,
      hasTicket: r.tickets.length > 0,
      hasPR: r.prs.length > 0,
    };
  }

  private evictIfNeeded(): void {
    while (this.records.size > this.maxSessions) {
      const oldest = this.records.keys().next().value;
      if (oldest === undefined) return;
      this.records.delete(oldest);
    }
  }
}
