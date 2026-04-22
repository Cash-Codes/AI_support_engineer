import cors from "cors";
import express, { type Express, Router } from "express";
import type { AppConfig } from "./config.js";
import type { Logger } from "./logger.js";
import { buildChatRouter } from "./routes/chat.js";
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
  /** Skips static /widget/* mounting — useful in tests. */
  skipWidgetStatic?: boolean;
}

export function createApp({
  config,
  logger,
  sessions = new SessionStore(),
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
  widgetRouter.use(buildChatRouter({ config, logger, sessions }));
  if (!skipWidgetStatic) widgetRouter.use(buildWidgetRouter());
  app.use(widgetRouter);

  // Dashboard-facing routes: health + /sessions reads.
  const dashboardRouter: ReturnType<typeof Router> = Router();
  dashboardRouter.use(dashboardCors);
  dashboardRouter.use(buildHealthRouter(config));
  dashboardRouter.use(buildSessionReadRouter(sessions));
  app.use(dashboardRouter);

  logger.info(
    {
      port: config.port,
      claude: config.claude.mode,
      shortcut: config.shortcut.mode,
      github: config.github.mode,
      demoMode: config.demoMode,
      widgetOriginsConfigured: config.cors.widgetOrigins.length,
    },
    "app created",
  );

  return app;
}
