import { Router, type Router as RouterType } from "express";
import type { AppConfig } from "../config.js";

export function buildHealthRouter(config: AppConfig): RouterType {
  const router: RouterType = Router();
  router.get("/health", (_req, res) => {
    res.json({
      ok: true,
      mode: config.claude.mode,
      shortcut: config.shortcut.mode,
      github: config.github.mode,
      demoMode: config.demoMode,
      ragIndexed: 0,
    });
  });
  return router;
}
