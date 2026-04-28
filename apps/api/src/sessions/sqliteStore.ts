import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  ChatMessage,
  ChatRole,
  Confidence,
  PRSummary,
  PipelineTrace,
  SessionDetail,
  SessionSummary,
  TicketSummary,
} from "@ai-support/shared";
import Database, { type Database as DB, type Statement } from "better-sqlite3";
import { DEFAULT_MAX_SESSIONS, type SessionStore } from "./store.js";

interface RawSession {
  session_id: string;
  product: string;
  created_at: string;
  last_activity_at: string;
}

interface RawMessage {
  id: string;
  session_id: string;
  role: ChatRole;
  content: string;
  created_at: string;
}

interface RawTrace {
  payload: string;
}

interface RawTicket {
  ticket_id: string;
  ticket_url: string;
  provider: string;
}

interface RawPR {
  pr_url: string;
  branch: string;
  provider: string;
}

/**
 * SQLite-backed session store. Schema is created on first connection;
 * concurrent writes from the api process are safe (better-sqlite3 is
 * synchronous and the api is single-process). Multi-instance Cloud Run
 * is NOT supported by this store — that's a v2 problem.
 */
export class SqliteSessionStore implements SessionStore {
  private readonly db: DB;
  private readonly maxSessions: number;
  private readonly stmts: ReturnType<typeof prepareStatements>;

  constructor(opts: { dbPath: string; maxSessions?: number }) {
    if (opts.dbPath !== ":memory:") {
      fs.mkdirSync(path.dirname(opts.dbPath), { recursive: true });
    }
    this.db = new Database(opts.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("foreign_keys = ON");
    this.maxSessions = opts.maxSessions ?? DEFAULT_MAX_SESSIONS;
    initSchema(this.db);
    this.stmts = prepareStatements(this.db);
  }

  close(): void {
    this.db.close();
  }

  create(product: string): SessionSummary {
    const now = new Date().toISOString();
    const sessionId = randomUUID();
    this.stmts.insertSession.run(sessionId, product, now, now);
    this.evictIfNeeded();
    return {
      sessionId,
      product,
      createdAt: now,
      lastActivityAt: now,
      messageCount: 0,
      latestConfidence: undefined,
      hasTicket: false,
      hasPR: false,
    };
  }

  has(sessionId: string): boolean {
    return this.stmts.hasSession.get(sessionId) !== undefined;
  }

  appendMessage(sessionId: string, message: ChatMessage): void {
    this.assertExists(sessionId);
    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      this.stmts.insertMessage.run(
        message.id,
        sessionId,
        message.role,
        message.content,
        message.createdAt,
      );
      this.stmts.touchSession.run(now, sessionId);
    });
    tx();
  }

  appendTrace(sessionId: string, trace: PipelineTrace): void {
    this.assertExists(sessionId);
    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      this.stmts.insertTrace.run(sessionId, JSON.stringify(trace), now);
      this.stmts.touchSession.run(now, sessionId);
    });
    tx();
  }

  appendTicket(sessionId: string, ticket: TicketSummary): void {
    this.assertExists(sessionId);
    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      this.stmts.insertTicket.run(
        sessionId,
        ticket.ticketId,
        ticket.ticketUrl,
        ticket.provider,
        now,
      );
      this.stmts.touchSession.run(now, sessionId);
    });
    tx();
  }

  appendPR(sessionId: string, pr: PRSummary): void {
    this.assertExists(sessionId);
    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      this.stmts.insertPR.run(sessionId, pr.branch, pr.prUrl, pr.provider, now);
      this.stmts.touchSession.run(now, sessionId);
    });
    tx();
  }

  list(limit = 50): SessionSummary[] {
    const rows = this.stmts.listSessions.all(limit) as RawSession[];
    return rows.map((r) => this.buildSummary(r));
  }

  getDetail(sessionId: string): SessionDetail | undefined {
    const session = this.stmts.getSession.get(sessionId) as
      | RawSession
      | undefined;
    if (!session) return undefined;

    const messages = (
      this.stmts.getMessages.all(sessionId) as RawMessage[]
    ).map(
      (m): ChatMessage => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
      }),
    );

    const traces = (this.stmts.getTraces.all(sessionId) as RawTrace[]).map(
      (t) => JSON.parse(t.payload) as PipelineTrace,
    );

    const tickets = (this.stmts.getTickets.all(sessionId) as RawTicket[]).map(
      (t): TicketSummary => ({
        ticketId: t.ticket_id,
        ticketUrl: t.ticket_url,
        provider: t.provider as TicketSummary["provider"],
      }),
    );

    const prs = (this.stmts.getPRs.all(sessionId) as RawPR[]).map(
      (p): PRSummary => ({
        branch: p.branch,
        prUrl: p.pr_url,
        provider: p.provider as PRSummary["provider"],
      }),
    );

    return {
      summary: this.buildSummary(session, { messages, traces, tickets, prs }),
      messages,
      traces,
      tickets,
      prs,
    };
  }

  size(): number {
    const row = this.stmts.countSessions.get() as { n: number };
    return row.n;
  }

  private assertExists(sessionId: string): void {
    if (!this.has(sessionId)) {
      throw new Error(`session not found: ${sessionId}`);
    }
  }

  private buildSummary(
    s: RawSession,
    preloaded?: {
      messages: ChatMessage[];
      traces: PipelineTrace[];
      tickets: TicketSummary[];
      prs: PRSummary[];
    },
  ): SessionSummary {
    const counts = preloaded
      ? {
          messageCount: preloaded.messages.length,
          latestConfidence:
            preloaded.traces[preloaded.traces.length - 1]?.confidence,
          hasTicket: preloaded.tickets.length > 0,
          hasPR: preloaded.prs.length > 0,
        }
      : this.deriveSummaryCounts(s.session_id);

    return {
      sessionId: s.session_id,
      product: s.product,
      createdAt: s.created_at,
      lastActivityAt: s.last_activity_at,
      ...counts,
    };
  }

  private deriveSummaryCounts(sessionId: string): {
    messageCount: number;
    latestConfidence: Confidence | undefined;
    hasTicket: boolean;
    hasPR: boolean;
  } {
    const m = this.stmts.countMessages.get(sessionId) as { n: number };
    const t = this.stmts.countTickets.get(sessionId) as { n: number };
    const p = this.stmts.countPRs.get(sessionId) as { n: number };
    const lastTraceRow = this.stmts.getLatestTrace.get(sessionId) as
      | RawTrace
      | undefined;
    const latestConfidence = lastTraceRow
      ? (JSON.parse(lastTraceRow.payload) as PipelineTrace).confidence
      : undefined;
    return {
      messageCount: m.n,
      latestConfidence,
      hasTicket: t.n > 0,
      hasPR: p.n > 0,
    };
  }

  private evictIfNeeded(): void {
    const total = this.size();
    if (total <= this.maxSessions) return;
    const overflow = total - this.maxSessions;
    this.stmts.evictOldest.run(overflow);
  }
}

function initSchema(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id        TEXT PRIMARY KEY,
      product           TEXT NOT NULL,
      created_at        TEXT NOT NULL,
      last_activity_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_activity
      ON sessions(last_activity_at DESC);

    CREATE TABLE IF NOT EXISTS messages (
      id          TEXT PRIMARY KEY,
      session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
      role        TEXT NOT NULL,
      content     TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_session
      ON messages(session_id, created_at);

    CREATE TABLE IF NOT EXISTS traces (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
      payload     TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_traces_session
      ON traces(session_id, id);

    CREATE TABLE IF NOT EXISTS tickets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
      ticket_id   TEXT NOT NULL,
      ticket_url  TEXT NOT NULL,
      provider    TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tickets_session
      ON tickets(session_id, id);

    CREATE TABLE IF NOT EXISTS prs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
      branch      TEXT NOT NULL,
      pr_url      TEXT NOT NULL,
      provider    TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_prs_session
      ON prs(session_id, id);
  `);
}

interface PreparedStatements {
  insertSession: Statement;
  hasSession: Statement;
  getSession: Statement;
  listSessions: Statement;
  countSessions: Statement;
  touchSession: Statement;
  evictOldest: Statement;
  insertMessage: Statement;
  getMessages: Statement;
  countMessages: Statement;
  insertTrace: Statement;
  getTraces: Statement;
  getLatestTrace: Statement;
  insertTicket: Statement;
  getTickets: Statement;
  countTickets: Statement;
  insertPR: Statement;
  getPRs: Statement;
  countPRs: Statement;
}

function prepareStatements(db: DB): PreparedStatements {
  return {
    insertSession: db.prepare(
      "INSERT INTO sessions (session_id, product, created_at, last_activity_at) VALUES (?, ?, ?, ?)",
    ),
    hasSession: db.prepare("SELECT 1 FROM sessions WHERE session_id = ?"),
    getSession: db.prepare("SELECT * FROM sessions WHERE session_id = ?"),
    listSessions: db.prepare(
      "SELECT * FROM sessions ORDER BY last_activity_at DESC, rowid DESC LIMIT ?",
    ),
    countSessions: db.prepare("SELECT COUNT(*) AS n FROM sessions"),
    touchSession: db.prepare(
      "UPDATE sessions SET last_activity_at = ? WHERE session_id = ?",
    ),
    evictOldest: db.prepare(`
      DELETE FROM sessions WHERE session_id IN (
        SELECT session_id FROM sessions
        ORDER BY last_activity_at ASC, rowid ASC
        LIMIT ?
      )
    `),
    insertMessage: db.prepare(
      "INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
    ),
    getMessages: db.prepare(
      "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC, id ASC",
    ),
    countMessages: db.prepare(
      "SELECT COUNT(*) AS n FROM messages WHERE session_id = ?",
    ),
    insertTrace: db.prepare(
      "INSERT INTO traces (session_id, payload, created_at) VALUES (?, ?, ?)",
    ),
    getTraces: db.prepare(
      "SELECT payload FROM traces WHERE session_id = ? ORDER BY id ASC",
    ),
    getLatestTrace: db.prepare(
      "SELECT payload FROM traces WHERE session_id = ? ORDER BY id DESC LIMIT 1",
    ),
    insertTicket: db.prepare(
      "INSERT INTO tickets (session_id, ticket_id, ticket_url, provider, created_at) VALUES (?, ?, ?, ?, ?)",
    ),
    getTickets: db.prepare(
      "SELECT ticket_id, ticket_url, provider FROM tickets WHERE session_id = ? ORDER BY id ASC",
    ),
    countTickets: db.prepare(
      "SELECT COUNT(*) AS n FROM tickets WHERE session_id = ?",
    ),
    insertPR: db.prepare(
      "INSERT INTO prs (session_id, branch, pr_url, provider, created_at) VALUES (?, ?, ?, ?, ?)",
    ),
    getPRs: db.prepare(
      "SELECT branch, pr_url, provider FROM prs WHERE session_id = ? ORDER BY id ASC",
    ),
    countPRs: db.prepare("SELECT COUNT(*) AS n FROM prs WHERE session_id = ?"),
  };
}
