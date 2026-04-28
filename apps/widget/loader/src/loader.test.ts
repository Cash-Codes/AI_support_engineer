import { afterEach, describe, expect, it } from "vitest";
import { mount, readConfigFromScript } from "./loader.js";

afterEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

describe("readConfigFromScript", () => {
  it("reads data-api-base and data-product from a script element", () => {
    const script = document.createElement("script");
    script.src = "https://api.example.com/widget/loader.js";
    script.dataset.apiBase = "https://api.example.com";
    script.dataset.product = "acme-app";
    const config = readConfigFromScript(script);
    expect(config.apiBase).toBe("https://api.example.com");
    expect(config.product).toBe("acme-app");
    expect(config.suggestions).toBeUndefined();
  });

  it("falls back to script src origin when data-api-base is missing", () => {
    const script = document.createElement("script");
    script.src = "https://api.example.com/widget/loader.js";
    const config = readConfigFromScript(script);
    expect(config.apiBase).toBe("https://api.example.com");
    expect(config.product).toBe("unknown");
  });

  it("parses data-suggestions JSON when present and well-formed", () => {
    const script = document.createElement("script");
    script.src = "https://api.example.com/widget/loader.js";
    script.dataset.suggestions = JSON.stringify([
      { label: "A", query: "do A" },
      { label: "B", query: "do B" },
    ]);
    const config = readConfigFromScript(script);
    expect(config.suggestions).toEqual([
      { label: "A", query: "do A" },
      { label: "B", query: "do B" },
    ]);
  });

  it("ignores malformed suggestions silently", () => {
    const script = document.createElement("script");
    script.src = "https://api.example.com/widget/loader.js";
    script.dataset.suggestions = "{not-json";
    const config = readConfigFromScript(script);
    expect(config.suggestions).toBeUndefined();
  });
});

describe("mount", () => {
  it("injects a launcher button and a hidden iframe pointing at the widget URL", () => {
    const result = mount({
      apiBase: "https://api.example.com",
      product: "acme-app",
    });

    expect(result.button).toBeInstanceOf(HTMLButtonElement);
    expect(result.iframe).toBeInstanceOf(HTMLIFrameElement);
    expect(result.iframe.dataset.open).toBe("false");
    expect(result.iframe.src).toBe(
      "https://api.example.com/widget/?product=acme-app",
    );
    expect(document.body.contains(result.button)).toBe(true);
    expect(document.body.contains(result.iframe)).toBe(true);
    const style = document.querySelector(
      'style[data-ai-support-widget="styles"]',
    );
    expect(style).not.toBeNull();
  });

  it("forwards suggestions through the iframe URL when configured", () => {
    const result = mount({
      apiBase: "https://api.example.com",
      product: "acme-app",
      suggestions: [{ label: "A", query: "do A" }],
    });
    const iframeSrc = new URL(result.iframe.src);
    expect(iframeSrc.searchParams.get("product")).toBe("acme-app");
    const raw = iframeSrc.searchParams.get("suggestions");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? "[]")).toEqual([{ label: "A", query: "do A" }]);
  });

  it("toggles iframe data-open on button click", () => {
    const { button, iframe } = mount({
      apiBase: "https://api.example.com",
      product: "acme-app",
    });
    expect(iframe.dataset.open).toBe("false");
    button.click();
    expect(iframe.dataset.open).toBe("true");
    button.click();
    expect(iframe.dataset.open).toBe("false");
  });
});
