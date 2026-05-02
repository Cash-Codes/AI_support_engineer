import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { Router, type Router as RouterType } from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolves to the repo-root `dist/dashboard/` directory produced by
 * `pnpm --filter @ai-support/dashboard build`. Built with
 * `base: "/dashboard/"`, so its index.html references assets at
 * `/dashboard/assets/...`.
 */
const DEFAULT_DASHBOARD_DIST = path.resolve(
  __dirname,
  "../../../../dist/dashboard",
);

export function buildDashboardRouter(
  dashboardDistDir: string = DEFAULT_DASHBOARD_DIST,
): RouterType {
  const router: RouterType = Router();

  // Static assets (hashed filenames - long cache safe).
  router.use(
    "/dashboard",
    express.static(dashboardDistDir, {
      maxAge: "1h",
      index: "index.html",
      // SPA fallback handled below - don't 404 on missing files here.
      fallthrough: true,
    }),
  );

  // Client-side routing fallback. Any /dashboard/<...> URL that didn't
  // match a static file falls through to index.html so React Router can
  // pick up the route.
  router.get("/dashboard/*", (_req, res, next) => {
    const indexHtml = path.join(dashboardDistDir, "index.html");
    if (!fs.existsSync(indexHtml)) {
      next();
      return;
    }
    res.sendFile(indexHtml);
  });

  return router;
}
