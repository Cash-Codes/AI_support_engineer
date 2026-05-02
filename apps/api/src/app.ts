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
import { buildDashboardRouter } from "./routes/dashboard.js";
import { buildDemoRouter } from "./routes/demo.js";
import { buildHealthRouter } from "./routes/health.js";
import {
  buildSessionInitRouter,
  buildSessionReadRouter,
} from "./routes/session.js";
import { buildWidgetRouter } from "./routes/widget.js";
import { InMemorySessionStore, type SessionStore } from "./sessions/store.js";

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
  /** Fixture library - powers the mock client's ticket/PR metadata lookup. */
  fixtures?: FixtureLibrary;
  /** Absolute path to the product repo - required for the live fix-PR flow. */
  productRepoPath?: string;
  /** Base branch the openFixPR worktree forks from. Defaults to "main". */
  productRepoBaseBranch?: string;
  /** Skips static /widget/* and /demo/* mounting - useful in tests. */
  skipWidgetStatic?: boolean;
}

export function createApp({
  config,
  logger,
  sessions = new InMemorySessionStore(),
  retriever,
  claude,
  shortcut,
  github,
  fixtures,
  productRepoPath,
  productRepoBaseBranch,
  skipWidgetStatic = false,
}: CreateAppDeps): Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // The iframe served at /widget/ runs on the api's own origin. Its
  // crossorigin-attributed asset requests carry an Origin header, so the
  // CORS check has to recognise "same as the request host" without
  // baking the public hostname (Cloud Run / localhost / etc) into the
  // env. We resolve same-origin per request from the proxy headers.
  const widgetCors: express.RequestHandler = (req, res, next) => {
    const xfProto = req.headers["x-forwarded-proto"];
    const proto =
      (Array.isArray(xfProto) ? xfProto[0] : xfProto)?.split(",")[0]?.trim() ||
      (req.secure ? "https" : "http");
    const host = req.headers.host;
    const sameOrigin = host ? `${proto}://${host}` : null;

    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (sameOrigin && origin === sameOrigin) return cb(null, true);
        if (config.cors.widgetOrigins.length === 0) return cb(null, true); // dev default
        if (config.cors.widgetOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`origin ${origin} not allowed`));
      },
      credentials: false,
    })(req, res, next);
  };

  const dashboardCors = cors({
    origin: config.cors.dashboardOrigin ?? true,
    credentials: false,
  });

  // Widget-facing routes: session init, chat SSE, JSON alias and the loader/iframe statics.
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
      productRepoBaseBranch,
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
  dashboardRouter.use(
    buildHealthRouter({
      config,
      retriever,
      claudeMode: claude?.mode ?? config.claude.mode,
      shortcutMode: shortcut?.mode ?? config.shortcut.mode,
      githubMode: github?.mode ?? config.github.mode,
    }),
  );
  dashboardRouter.use(buildSessionReadRouter(sessions));
  if (!skipWidgetStatic) {
    dashboardRouter.use(buildDashboardRouter());
  }
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
