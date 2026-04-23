import { randomUUID } from "node:crypto";
import type { ChatMessage, ChatResponse, PhaseEvent } from "@ai-support/shared";
import { Router, type Router as RouterType } from "express";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";
import { type PipelineOverrides, runPipeline } from "../orchestrator/index.js";
import type { Retriever } from "../rag/indexer.js";
import type { SessionStore } from "../sessions/store.js";

const ChatBody = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1).max(4000),
});

const SupportQueryBody = z.object({
  sessionId: z.string().min(1).optional(),
  product: z.string().min(1).max(100).optional(),
  message: z.string().min(1).max(4000),
});

export interface ChatRouterDeps {
  config: AppConfig;
  logger: Logger;
  sessions: SessionStore;
  retriever?: Retriever;
}

export function buildChatRouter(deps: ChatRouterDeps): RouterType {
  const { config, logger, sessions, retriever } = deps;
  const router: RouterType = Router();

  const overrides: PipelineOverrides | undefined = retriever
    ? {
        docsRetrieval: async (intake) => ({
          docs: await retriever.search(intake.normalized, 5),
        }),
      }
    : undefined;

  router.post("/chat", async (req, res) => {
    const parsed = ChatBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "invalid body", details: parsed.error.flatten() });
      return;
    }
    const { sessionId, message } = parsed.data;

    if (!sessions.has(sessionId)) {
      res.status(404).json({ error: "session not found" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const writeFrame = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const userMessage: ChatMessage = {
      id: randomUUID(),
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    sessions.appendMessage(sessionId, userMessage);

    const emit = (e: PhaseEvent) => writeFrame("phase", e);

    try {
      const response = await runPipeline(
        { message },
        {
          sessionId,
          flags: { prFlow: config.enablePrFlow },
          emit,
          logger,
          overrides,
        },
      );
      sessions.appendMessage(sessionId, response.assistantMessage);
      sessions.appendTrace(sessionId, response.pipeline);
      if (response.ticket) sessions.appendTicket(sessionId, response.ticket);
      if (response.pr) sessions.appendPR(sessionId, response.pr);
      writeFrame("complete", response);
    } catch (err) {
      logger.error({ err }, "pipeline failed");
      writeFrame("error", {
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      res.end();
    }
  });

  // Plain-JSON alias — waits for pipeline to complete, returns ChatResponse.
  router.post("/api/support/query", async (req, res) => {
    const parsed = SupportQueryBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "invalid body", details: parsed.error.flatten() });
      return;
    }
    const { sessionId: inputSession, product, message } = parsed.data;

    const sessionId =
      inputSession && sessions.has(inputSession)
        ? inputSession
        : sessions.create(product ?? "unknown").sessionId;

    const userMessage: ChatMessage = {
      id: randomUUID(),
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    sessions.appendMessage(sessionId, userMessage);

    try {
      const response: ChatResponse = await runPipeline(
        { message },
        {
          sessionId,
          flags: { prFlow: config.enablePrFlow },
          emit: () => undefined,
          logger,
          overrides,
        },
      );
      sessions.appendMessage(sessionId, response.assistantMessage);
      sessions.appendTrace(sessionId, response.pipeline);
      if (response.ticket) sessions.appendTicket(sessionId, response.ticket);
      if (response.pr) sessions.appendPR(sessionId, response.pr);
      res.json(response);
    } catch (err) {
      logger.error({ err }, "api/support/query pipeline failed");
      res.status(500).json({
        error: "pipeline failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return router;
}
