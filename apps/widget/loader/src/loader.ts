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
      padding: 0;
      border: none;
      border-radius: 9999px;
      background: #0f172a;
      color: white;
      font-size: 26px;
      line-height: 1;
      cursor: pointer;
      display: grid;
      place-items: center;
      box-shadow:
        0 10px 25px -5px rgba(15, 23, 42, 0.35),
        0 2px 6px rgba(15, 23, 42, 0.25);
      animation: ai-support-float 4s ease-in-out infinite;
      transition:
        transform 0.25s cubic-bezier(0.22, 1, 0.36, 1),
        box-shadow 0.25s ease,
        background 0.25s ease,
        opacity 0.2s ease;
    }
    .ai-support-widget-launcher[data-open="true"] {
      opacity: 0;
      transform: scale(0.8);
      pointer-events: none;
    }
    .ai-support-widget-launcher::before {
      content: "";
      position: absolute;
      inset: -4px;
      border-radius: 9999px;
      background: radial-gradient(circle, rgba(99,102,241,0.35), transparent 70%);
      opacity: 0.6;
      z-index: -1;
      animation: ai-support-halo 3s ease-in-out infinite;
    }
    .ai-support-widget-launcher:hover {
      transform: translateY(-3px) scale(1.05);
      background: #1e293b;
      box-shadow:
        0 14px 30px -6px rgba(15, 23, 42, 0.45),
        0 3px 8px rgba(15, 23, 42, 0.3);
    }
    .ai-support-widget-launcher:active {
      transform: translateY(-1px) scale(1);
    }
    .ai-support-widget-launcher:focus-visible {
      outline: 2px solid #a5b4fc;
      outline-offset: 3px;
    }
    @keyframes ai-support-float {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-4px); }
    }
    @keyframes ai-support-halo {
      0%, 100% { opacity: 0.4; transform: scale(1); }
      50%      { opacity: 0.75; transform: scale(1.08); }
    }

    .ai-support-widget-frame {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 2147483647;
      width: 380px;
      height: 560px;
      max-height: calc(100vh - 48px);
      border: none;
      border-radius: 16px;
      background: white;
      box-shadow: 0 20px 40px -10px rgba(15, 23, 42, 0.35);
      opacity: 0;
      transform: translateY(8px) scale(0.98);
      transform-origin: bottom right;
      pointer-events: none;
      transition:
        opacity 0.2s ease,
        transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .ai-support-widget-frame[data-open="true"] {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }

    @media (prefers-reduced-motion: reduce) {
      .ai-support-widget-launcher,
      .ai-support-widget-launcher::before,
      .ai-support-widget-frame {
        animation: none !important;
        transition: none !important;
      }
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
  button.dataset.open = "false";
  button.innerHTML = '<span aria-hidden="true">💬</span>';

  const iframe = doc.createElement("iframe");
  iframe.className = "ai-support-widget-frame";
  iframe.title = "AI Support Chat";
  const iframeUrl = new URL("/widget/", config.apiBase);
  iframeUrl.searchParams.set("product", config.product);
  iframe.src = iframeUrl.toString();
  iframe.dataset.open = "false";

  const setOpen = (open: boolean) => {
    iframe.dataset.open = String(open);
    button.dataset.open = String(open);
    button.setAttribute(
      "aria-label",
      open ? "Close support chat" : "Open support chat",
    );
  };

  button.addEventListener("click", () => {
    setOpen(iframe.dataset.open !== "true");
  });

  const win = doc.defaultView;
  if (win) {
    win.addEventListener("message", (event) => {
      if (event.source !== iframe.contentWindow) return;
      const data = event.data as { type?: string } | null;
      if (!data || typeof data.type !== "string") return;
      if (data.type === "ai-support:close") setOpen(false);
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
