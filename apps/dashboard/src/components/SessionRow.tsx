import type { SessionSummary } from "@ai-support/shared";
import { Link } from "react-router-dom";

interface Props {
  session: SessionSummary;
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};

export function SessionRow({ session }: Props) {
  return (
    <Link
      to={`/sessions/${session.sessionId}`}
      className="flex items-center justify-between rounded-lg bg-white px-4 py-3 ring-1 ring-slate-200 hover:ring-slate-300"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-500">
            {session.sessionId.slice(0, 8)}
          </span>
          <span className="text-xs font-medium text-slate-700">
            {session.product}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          {session.messageCount} message{session.messageCount === 1 ? "" : "s"}
          {" · "}
          {new Date(session.lastActivityAt).toLocaleString()}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {session.latestConfidence ? (
          <span
            className={`rounded px-2 py-0.5 text-[11px] font-medium ${
              CONFIDENCE_STYLES[session.latestConfidence] ?? ""
            }`}
          >
            {session.latestConfidence}
          </span>
        ) : null}
        {session.hasTicket ? (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
            ticket
          </span>
        ) : null}
        {session.hasPR ? (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
            pr
          </span>
        ) : null}
      </div>
    </Link>
  );
}
