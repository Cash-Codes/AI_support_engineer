import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { parseConfig } from "../config.js";
import { createLogger } from "../logger.js";

function buildTestApp(env: NodeJS.ProcessEnv = {}) {
  const config = parseConfig(env);
  const logger = createLogger({ logLevel: "fatal" });
  return createApp({ config, logger });
}

describe("GET /health", () => {
  it("returns ok with all mode fields in default (mock) state", async () => {
    const res = await request(buildTestApp()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      mode: "mock",
      shortcut: "mock",
      github: "mock",
      demoMode: false,
      ragIndexed: 0,
    });
  });

  it("reports shortcut as live when token configured", async () => {
    const res = await request(buildTestApp({ SHORTCUT_API_TOKEN: "tok" })).get(
      "/health",
    );
    expect(res.status).toBe(200);
    expect(res.body.shortcut).toBe("live");
    expect(res.body.github).toBe("mock");
  });
});
