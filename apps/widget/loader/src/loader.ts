export interface LoaderConfig {
  apiBase: string;
  product: string;
}

export function readConfigFromScript(
  script: HTMLScriptElement | null,
): LoaderConfig {
  const apiBase =
    script?.dataset.apiBase ??
    new URL(".", script?.src ?? location.href).origin;
  const product = script?.dataset.product ?? "unknown";
  return { apiBase, product };
}

export function injectStyles(doc: Document): void {
  const style = doc.createElement("style");
  style.dataset.aiSupportWidget = "styles";
  style.textContent = `
    .ai-support-widget-launcher {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 2147483646;
      width: 56px;
      height: 56px;
      border-radius: 9999px;
      border: none;
      background: #0f172a;
      color: white;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }
    .ai-support-widget-frame {
      position: fixed;
      right: 24px;
      bottom: 96px;
      z-index: 2147483647;
      width: 380px;
      height: 560px;
      max-height: calc(100vh - 120px);
      border: none;
      border-radius: 16px;
      box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.35);
      background: white;
      display: none;
    }
    .ai-support-widget-frame[data-open="true"] {
      display: block;
    }
  `;
  doc.head.appendChild(style);
}

export interface MountedWidget {
  button: HTMLButtonElement;
  iframe: HTMLIFrameElement;
}

export function mount(
  config: LoaderConfig,
  doc: Document = document,
): MountedWidget {
  injectStyles(doc);

  const button = doc.createElement("button");
  button.className = "ai-support-widget-launcher";
  button.type = "button";
  button.setAttribute("aria-label", "Open support chat");
  button.textContent = "💬";

  const iframe = doc.createElement("iframe");
  iframe.className = "ai-support-widget-frame";
  iframe.title = "AI Support Chat";
  const iframeUrl = new URL("/widget/", config.apiBase);
  iframeUrl.searchParams.set("product", config.product);
  iframe.src = iframeUrl.toString();
  iframe.dataset.open = "false";

  button.addEventListener("click", () => {
    const isOpen = iframe.dataset.open === "true";
    iframe.dataset.open = String(!isOpen);
  });

  const win = doc.defaultView;
  if (win) {
    win.addEventListener("message", (event) => {
      if (event.source !== iframe.contentWindow) return;
      const data = event.data as { type?: string } | null;
      if (!data || typeof data.type !== "string") return;
      if (data.type === "ai-support:close") iframe.dataset.open = "false";
    });
  }

  doc.body.appendChild(button);
  doc.body.appendChild(iframe);
  return { button, iframe };
}

function autoMount() {
  const script = document.currentScript as HTMLScriptElement | null;
  mount(readConfigFromScript(script));
}

if (typeof document !== "undefined" && !("VITEST" in globalThis)) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMount);
  } else {
    autoMount();
  }
}
