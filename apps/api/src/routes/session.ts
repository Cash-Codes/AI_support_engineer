import { Router, type Router as RouterType } from "express";
import { z } from "zod";
import type { SessionStore } from "../sessions/store.js";

const InitBody = z.object({
  product: z.string().min(1).max(100),
});

/** POST /session/init — called by the widget (widget CORS). */
export function buildSessionInitRouter(store: SessionStore): RouterType {
  const router: RouterType = Router();
  router.post("/session/init", (req, res) => {
    const parsed = InitBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "invalid body", details: parsed.error.flatten() });
      return;
    }
    const summary = store.create(parsed.data.product);
    res.json({ sessionId: summary.sessionId });
  });
  return router;
}

/** GET /sessions, GET /sessions/:id — read-only, called by the dashboard. */
export function buildSessionReadRouter(store: SessionStore): RouterType {
  const router: RouterType = Router();

  router.get("/sessions", (_req, res) => {
    res.json(store.list());
  });

  router.get("/sessions/:id", (req, res) => {
    const detail = store.getDetail(req.params.id);
    if (!detail) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    res.json(detail);
  });

  return router;
}
