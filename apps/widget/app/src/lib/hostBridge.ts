export type HostMessage =
  | { type: "ai-support:close" }
  | { type: "ai-support:ready" };

export function postToHost(message: HostMessage): void {
  if (typeof window === "undefined") return;
  if (!window.parent || window.parent === window) return;
  window.parent.postMessage(message, "*");
}
