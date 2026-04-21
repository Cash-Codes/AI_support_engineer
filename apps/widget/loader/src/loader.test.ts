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
    expect(config).toEqual({
      apiBase: "https://api.example.com",
      product: "acme-app",
    });
  });

  it("falls back to script src origin when data-api-base is missing", () => {
    const script = document.createElement("script");
    script.src = "https://api.example.com/widget/loader.js";
    const config = readConfigFromScript(script);
    expect(config.apiBase).toBe("https://api.example.com");
    expect(config.product).toBe("unknown");
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
