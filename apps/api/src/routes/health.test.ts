import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

describe("GET /health", () => {
  it("returns ok with mode + ragIndexed", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      mode: "mock",
      ragIndexed: 0,
    });
  });
});
