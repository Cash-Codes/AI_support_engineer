import cors from "cors";
import express, { type Express, Router } from "express";
import type { ClaudeClient } from "./clients/claude.js";
import type { GithubClient } from "./clients/github.js";
import type { ShortcutClient } from "./clients/shortcut.js";
import type { AppConfig } from "./config.js";
import type { FixtureLibrary } from "./fixtures/index.js";
import type { Logger } from "./logger.js";
import type { Retriever } from "./rag/indexer.js";
import { buildChatRouter } from "./routes/chat.js";
import { buildDemoRouter } from "./routes/demo.js";
import { buildHealthRouter } from "./routes/health.js";
import {
  buildSessionInitRouter,
  buildSessionReadRouter,
} from "./routes/session.js";
import { buildWidgetRouter } from "./routes/widget.js";
import { SessionStore } from "./sessions/store.js";

export interface CreateAppDeps {
  config: AppConfig;
  logger: Logger;
  /** Injectable for tests; defaults to a fresh in-memory store. */
  sessions?: SessionStore;
  /** Injectable for tests. When absent, the pipeline uses the stub. */
  retriever?: Retriever;
  /** Injectable Claude client (live or mock). When absent, pipeline stubs are used. */
  claude?: ClaudeClient;
  /** Injectable Shortcut client (live or mock). When absent, pipeline stub is used. */
  shortcut?: ShortcutClient;
  /** Injectable GitHub client (live or mock). Required only for live PR flow. */
  github?: GithubClient;
  /** Fixture library — powers the mock client's ticket/PR metadata lookup. */
  fixtures?: FixtureLibrary;
  /** Absolute path to the product repo — required for the live fix-PR flow. */
  productRepoPath?: string;
  /** Skips static /widget/* and /demo/* mounting — useful in tests. */
  skipWidgetStatic?: boolean;
}

export function createApp({
  config,
  logger,
  sessions = new SessionStore(),
  retriever,
  claude,
  shortcut,
  github,
  fixtures,
  productRepoPath,
  skipWidgetStatic = false,
}: CreateAppDeps): Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const widgetCors = cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (config.cors.widgetOrigins.length === 0) return cb(null, true); // dev default
      if (config.cors.widgetOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`origin ${origin} not allowed`));
    },
    credentials: false,
  });

  const dashboardCors = cors({
    origin: config.cors.dashboardOrigin ?? true,
    credentials: false,
  });

  // Widget-facing routes: session init, chat SSE, JSON alias, and the loader/iframe statics.
  const widgetRouter: ReturnType<typeof Router> = Router();
  widgetRouter.use(widgetCors);
  widgetRouter.use(buildSessionInitRouter(sessions));
  widgetRouter.use(
    buildChatRouter({
      config,
      logger,
      sessions,
      retriever,
      claude,
      shortcut,
      github,
      fixtures,
      productRepoPath,
    }),
  );
  if (!skipWidgetStatic) {
    widgetRouter.use(buildWidgetRouter());
    widgetRouter.use(buildDemoRouter());
  }
  app.use(widgetRouter);

  // Dashboard-facing routes: health + /sessions reads.
  const dashboardRouter: ReturnType<typeof Router> = Router();
  dashboardRouter.use(dashboardCors);
  dashboardRouter.use(buildHealthRouter(config, retriever));
  dashboardRouter.use(buildSessionReadRouter(sessions));
  app.use(dashboardRouter);

  logger.info(
    {
      port: config.port,
      claude: claude?.mode ?? config.claude.mode,
      shortcut: shortcut?.mode ?? config.shortcut.mode,
      github: github?.mode ?? config.github.mode,
      demoMode: config.demoMode,
      widgetOriginsConfigured: config.cors.widgetOrigins.length,
      fixtures: fixtures?.all().length ?? 0,
    },
    "app created",
  );

  return app;
}
