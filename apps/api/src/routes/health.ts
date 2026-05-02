import { Router, type Router as RouterType } from "express";
import type { AppConfig } from "../config.js";
import type { Retriever } from "../rag/indexer.js";

export interface BuildHealthRouterDeps {
  config: AppConfig;
  retriever?: Retriever;
  /** Resolved at boot - reflects whether the live client is wired (not just config). */
  claudeMode: "live" | "mock";
  shortcutMode: "live" | "mock";
  githubMode: "live" | "mock";
}

export function buildHealthRouter(deps: BuildHealthRouterDeps): RouterType {
  const { config, retriever, claudeMode, shortcutMode, githubMode } = deps;
  const router: RouterType = Router();
  router.get("/health", (_req, res) => {
    res.json({
      ok: true,
      mode: claudeMode,
      shortcut: shortcutMode,
      github: githubMode,
      demoMode: config.demoMode,
      ragIndexed: retriever?.size() ?? 0,
    });
  });
  return router;
}
