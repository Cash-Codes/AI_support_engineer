import { describe, expect, it } from "vitest";
import { parseConfig } from "./config.js";

describe("parseConfig", () => {
  it("returns defaults when env is empty", () => {
    const cfg = parseConfig({});
    expect(cfg.port).toBe(8080);
    expect(cfg.logLevel).toBe("info");
    expect(cfg.demoMode).toBe(false);
    expect(cfg.enablePrFlow).toBe(false);
    expect(cfg.shortcut.mode).toBe("mock");
    expect(cfg.github.mode).toBe("mock");
    expect(cfg.claude.mode).toBe("mock");
    expect(cfg.cors.widgetOrigins).toEqual([]);
  });

  it("parses WIDGET_ALLOWED_ORIGINS as comma-separated list", () => {
    const cfg = parseConfig({
      WIDGET_ALLOWED_ORIGINS:
        "https://product.example.com, https://preview.example.com",
    });
    expect(cfg.cors.widgetOrigins).toEqual([
      "https://product.example.com",
      "https://preview.example.com",
    ]);
  });

  it("resolves shortcut to live when token present", () => {
    const cfg = parseConfig({ SHORTCUT_API_TOKEN: "tok" });
    expect(cfg.shortcut.mode).toBe("live");
    if (cfg.shortcut.mode === "live") {
      expect(cfg.shortcut.token).toBe("tok");
    }
  });

  it("keeps github mock when token present but flag off", () => {
    const cfg = parseConfig({
      GITHUB_TOKEN: "tok",
      ENABLE_PR_FLOW: "false",
      GITHUB_REPO: "o/r",
    });
    expect(cfg.github.mode).toBe("mock");
  });

  it("resolves github to live when token and flag on", () => {
    const cfg = parseConfig({
      GITHUB_TOKEN: "tok",
      ENABLE_PR_FLOW: "true",
      GITHUB_REPO: "o/r",
    });
    expect(cfg.github.mode).toBe("live");
    if (cfg.github.mode === "live") {
      expect(cfg.github.repo).toBe("o/r");
    }
  });

  it("rejects invalid LOG_LEVEL", () => {
    expect(() => parseConfig({ LOG_LEVEL: "nope" })).toThrow();
  });

  it("rejects invalid PORT", () => {
    expect(() => parseConfig({ PORT: "not-a-number" })).toThrow();
  });
});
