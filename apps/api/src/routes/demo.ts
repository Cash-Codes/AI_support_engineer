import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { Router, type Router as RouterType } from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolves to `<repo root>/demo/`. The demo/host.html file embeds the widget
 * loader and lets us smoke-test the full flow locally without a separate
 * static server.
 */
const DEFAULT_DEMO_DIR = path.resolve(__dirname, "../../../../demo");

export function buildDemoRouter(
  demoDir: string = DEFAULT_DEMO_DIR,
): RouterType {
  const router: RouterType = Router();
  router.use(
    "/demo",
    express.static(demoDir, {
      fallthrough: false,
      index: "host.html",
    }),
  );
  return router;
}
