import type { SessionDetail } from "@ai-support/shared";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MessageBubble } from "../components/MessageBubble.js";
import { PhaseTimeline } from "../components/PhaseTimeline.js";
import { fetchSessionDetail } from "../lib/api.js";

export function SessionViewer() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchSessionDetail(id)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) return <p className="text-sm text-slate-500">No session id.</p>;
  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (error) {
    return (
      <div className="space-y-2">
        <Link to="/" className="text-xs text-slate-500 underline">
          ← Back
        </Link>
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      </div>
    );
  }
  if (!detail) return null;

  const latestTrace = detail.traces[detail.traces.length - 1];

  return (
    <div className="grid grid-cols-[1fr_280px] gap-6">
      <section className="space-y-4">
        <Link to="/" className="text-xs text-slate-500 underline">
          ← Back to sessions
        </Link>
        <header className="space-y-1">
          <h2 className="font-mono text-sm text-slate-700">
            {detail.summary.sessionId}
          </h2>
          <p className="text-xs text-slate-500">
            {detail.summary.product} · {detail.summary.messageCount} messages
          </p>
        </header>
        <div className="space-y-2">
          {detail.messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {detail.messages.length === 0 ? (
            <p className="text-sm text-slate-400">No messages yet.</p>
          ) : null}
        </div>
      </section>

      <aside className="space-y-4">
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Latest trace
          </h3>
          <PhaseTimeline events={latestTrace?.events ?? []} />
        </div>

        {latestTrace?.retrievedDocs.length ? (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Retrieved docs
            </h3>
            <ul className="space-y-1 text-xs">
              {latestTrace.retrievedDocs.map((d) => (
                <li
                  key={d.title}
                  className="rounded bg-white px-2 py-1 ring-1 ring-slate-200"
                >
                  <span className="font-mono text-slate-700">{d.title}</span>
                  <span className="ml-2 text-slate-500">
                    {d.score.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {detail.tickets.length ? (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tickets
            </h3>
            <ul className="space-y-1 text-xs">
              {detail.tickets.map((t) => (
                <li
                  key={t.ticketId}
                  className="flex items-center justify-between rounded bg-white px-2 py-1 ring-1 ring-slate-200"
                >
                  <a href={t.ticketUrl} target="_blank" rel="noreferrer">
                    {t.ticketId}
                  </a>
                  <span className="text-slate-400">{t.provider}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {detail.prs.length ? (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              PRs
            </h3>
            <ul className="space-y-1 text-xs">
              {detail.prs.map((p) => (
                <li
                  key={p.prUrl}
                  className="flex items-center justify-between rounded bg-white px-2 py-1 ring-1 ring-slate-200"
                >
                  <a href={p.prUrl} target="_blank" rel="noreferrer">
                    {p.branch}
                  </a>
                  <span className="text-slate-400">{p.provider}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
