import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { Router, type Router as RouterType } from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolves to the repo-root `dist/widget/` directory produced by
 * `pnpm --filter @ai-support/widget build`. Both `loader/` and `app/`
 * subtrees are served from there.
 *
 *   dist/widget/loader/loader.js   → /widget/loader.js
 *   dist/widget/app/index.html     → /widget/ (iframe SPA entry)
 */
const DEFAULT_WIDGET_DIST = path.resolve(__dirname, "../../../../dist/widget");

export function buildWidgetRouter(
  widgetDistDir: string = DEFAULT_WIDGET_DIST,
): RouterType {
  const router: RouterType = Router();

  // Loader IIFE - embedded by the product app via <script>.
  router.use(
    "/widget/loader.js",
    express.static(path.join(widgetDistDir, "loader", "loader.js"), {
      // Short cache - we still expect to iterate.
      maxAge: "5m",
      fallthrough: false,
    }),
  );

  // Iframe SPA - everything else under /widget/.
  router.use(
    "/widget",
    express.static(path.join(widgetDistDir, "app"), {
      fallthrough: false,
      index: "index.html",
    }),
  );

  return router;
}
