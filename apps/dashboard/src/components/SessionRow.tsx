import type { SessionSummary } from "@ai-support/shared";
import { Link } from "react-router-dom";

interface Props {
  session: SessionSummary;
}

function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(delta / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const CONFIDENCE_STYLE: Record<string, string> = {
  high: "bg-success-weak text-success",
  medium: "bg-warning-weak text-warning",
  low: "bg-line text-fg-2",
};

export function SessionRow({ session }: Props) {
  const confidence = session.latestConfidence ?? "—";
  const confidenceCls =
    session.latestConfidence && CONFIDENCE_STYLE[session.latestConfidence]
      ? CONFIDENCE_STYLE[session.latestConfidence]
      : "bg-line text-fg-2";

  return (
    <Link
      to={`/sessions/${session.sessionId}`}
      className="group grid grid-cols-[minmax(0,1fr)_120px_120px_100px_24px] items-center gap-4 border-b border-line px-6 py-3 transition-colors hover:bg-brand-weak/40"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-medium text-fg-0">
            {session.sessionId.slice(0, 8)}
          </span>
          <span className="truncate text-sm text-fg-1">{session.product}</span>
        </div>
        <p className="mt-0.5 text-xs text-fg-2">
          {session.messageCount} message{session.messageCount === 1 ? "" : "s"}
          {" · "}
          {relativeTime(session.lastActivityAt)}
        </p>
      </div>

      <div>
        <span
          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${confidenceCls}`}
        >
          {confidence}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {session.hasTicket ? <Badge tone="info">ticket</Badge> : null}
        {session.hasPR ? <Badge tone="brand">pr</Badge> : null}
      </div>

      <div className="text-xs tabular-nums text-fg-2">
        {new Date(session.lastActivityAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>

      <span
        aria-hidden="true"
        className="text-fg-3 transition-[color,transform] duration-150 group-hover:translate-x-0.5 group-hover:text-brand"
      >
        ›
      </span>
    </Link>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "info" | "brand";
}) {
  const style =
    tone === "info" ? "bg-info-weak text-info" : "bg-brand-weak text-brand";
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${style}`}
    >
      {children}
    </span>
  );
}
