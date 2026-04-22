import type { SessionDetail, SessionSummary } from "@ai-support/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { parseConfig } from "../config.js";
import { createLogger } from "../logger.js";
import { SessionStore } from "../sessions/store.js";

function buildTestApp(
  env: NodeJS.ProcessEnv = {},
  sessions = new SessionStore(),
) {
  const config = parseConfig(env);
  const logger = createLogger({ logLevel: "fatal" });
  const app = createApp({ config, logger, sessions, skipWidgetStatic: true });
  return { app, sessions };
}

describe("Session + Chat routes", () => {
  it("POST /session/init creates a session and returns the id", async () => {
    const { app, sessions } = buildTestApp();
    const res = await request(app)
      .post("/session/init")
      .send({ product: "acme-app" });
    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBeTypeOf("string");
    expect(sessions.has(res.body.sessionId)).toBe(true);
  });

  it("POST /session/init rejects missing product", async () => {
    const { app } = buildTestApp();
    const res = await request(app).post("/session/init").send({});
    expect(res.status).toBe(400);
  });

  it("POST /chat rejects unknown sessionId with 404", async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post("/chat")
      .send({ sessionId: "does-not-exist", message: "hi" });
    expect(res.status).toBe(404);
  });

  it("POST /chat streams SSE frames and completes the pipeline", async () => {
    const { app, sessions } = buildTestApp();
    const init = await request(app)
      .post("/session/init")
      .send({ product: "acme" });
    const sessionId = init.body.sessionId as string;

    const res = await request(app)
      .post("/chat")
      .set("Accept", "text/event-stream")
      .send({ sessionId, message: "refund missing" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
    expect(res.text).toMatch(/event: phase/);
    expect(res.text).toMatch(/"phase":"intake"/);
    expect(res.text).toMatch(/event: complete/);

    const detail = sessions.getDetail(sessionId);
    expect(detail?.messages.length).toBeGreaterThanOrEqual(2);
    expect(detail?.tickets.length).toBe(1);
    expect(detail?.traces.length).toBe(1);
  });

  it("POST /api/support/query returns a plain-JSON ChatResponse", async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post("/api/support/query")
      .send({ product: "acme", message: "refund missing" });

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBeTypeOf("string");
    expect(res.body.assistantMessage.role).toBe("assistant");
    expect(res.body.pipeline.events.length).toBeGreaterThan(0);
    expect(res.body.ticket.provider).toBe("mock");
  });
});

describe("Dashboard read routes", () => {
  it("GET /sessions returns newest-first list after chat activity", async () => {
    const { app } = buildTestApp();
    await request(app).post("/session/init").send({ product: "a" });
    await request(app).post("/session/init").send({ product: "b" });

    const res = await request(app).get("/sessions");
    expect(res.status).toBe(200);
    const body = res.body as SessionSummary[];
    expect(body).toHaveLength(2);
    expect(body[0].product).toBe("b");
    expect(body[1].product).toBe("a");
  });

  it("GET /sessions/:id returns 404 for unknown id", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/sessions/unknown");
    expect(res.status).toBe(404);
  });

  it("GET /sessions/:id returns full detail after chat", async () => {
    const { app } = buildTestApp();
    const init = await request(app)
      .post("/session/init")
      .send({ product: "acme" });
    const sessionId = init.body.sessionId as string;

    await request(app)
      .post("/chat")
      .set("Accept", "text/event-stream")
      .send({ sessionId, message: "refund missing" });

    const res = await request(app).get(`/sessions/${sessionId}`);
    expect(res.status).toBe(200);
    const detail = res.body as SessionDetail;
    expect(detail.summary.sessionId).toBe(sessionId);
    expect(detail.summary.messageCount).toBeGreaterThanOrEqual(2);
    expect(detail.summary.hasTicket).toBe(true);
    expect(detail.traces.length).toBe(1);
  });
});
