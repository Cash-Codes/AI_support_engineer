import type { SessionDetail } from "@ai-support/shared";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MessageBubble } from "../components/MessageBubble.js";
import { PhaseTimeline } from "../components/PhaseTimeline.js";
import { fetchSessionDetail } from "../lib/api.js";

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CONFIDENCE_STYLE: Record<string, string> = {
  high: "bg-success-weak text-success",
  medium: "bg-warning-weak text-warning",
  low: "bg-line text-fg-2",
};

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

  if (!id) return <p className="text-sm text-fg-2">No session id in url.</p>;

  if (loading) return <p className="text-sm text-fg-2">Loading session…</p>;

  if (error) {
    return (
      <div className="space-y-4 fade-in">
        <BackLink />
        <div
          role="alert"
          className="rounded-md border border-danger/40 bg-danger-weak px-4 py-3"
        >
          <p className="text-sm font-medium text-danger">
            Unable to load session
          </p>
          <p className="mt-0.5 font-mono text-xs text-fg-1">{error}</p>
        </div>
      </div>
    );
  }
  if (!detail) return null;

  const latestTrace = detail.traces[detail.traces.length - 1];
  const confidenceCls =
    detail.summary.latestConfidence &&
    CONFIDENCE_STYLE[detail.summary.latestConfidence]
      ? CONFIDENCE_STYLE[detail.summary.latestConfidence]
      : "bg-line text-fg-2";

  return (
    <div className="space-y-6 fade-in">
      <BackLink />

      {/* Session header card */}
      <header className="rounded-lg border border-line bg-surface px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-fg-2">
              Session
            </p>
            <h1 className="mt-1 font-mono text-lg font-semibold text-fg-0">
              {detail.summary.sessionId}
            </h1>
            <p className="mt-1 text-sm text-fg-1">{detail.summary.product}</p>
          </div>

          {detail.summary.latestConfidence ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium ${confidenceCls}`}
            >
              Confidence: {detail.summary.latestConfidence}
            </span>
          ) : null}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm md:grid-cols-4">
          <Meta label="Created" value={fmtDateTime(detail.summary.createdAt)} />
          <Meta
            label="Last activity"
            value={fmtDateTime(detail.summary.lastActivityAt)}
          />
          <Meta
            label="Messages"
            value={detail.summary.messageCount.toString()}
          />
          <Meta
            label="Outputs"
            value={
              [
                detail.summary.hasTicket ? "Ticket" : null,
                detail.summary.hasPR ? "PR" : null,
              ]
                .filter(Boolean)
                .join(" · ") || "-"
            }
          />
        </dl>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Transcript */}
        <Card title="Transcript">
          {detail.messages.length === 0 ? (
            <p className="text-sm text-fg-2">No messages recorded.</p>
          ) : (
            <div className="space-y-3">
              {detail.messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </div>
          )}
        </Card>

        {/* Right-hand rail */}
        <aside className="space-y-6">
          <Card title="Pipeline">
            <PhaseTimeline events={latestTrace?.events ?? []} />
          </Card>

          {latestTrace?.retrievedDocs.length ? (
            <Card title="Retrieved docs">
              <ul className="space-y-2">
                {latestTrace.retrievedDocs.map((d) => (
                  <li key={d.title} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-fg-0">
                        {d.title}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-fg-2">
                        {d.score.toFixed(2)}
                      </span>
                    </div>
                    <ScoreBar score={d.score} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {detail.tickets.length ? (
            <Card title="Tickets">
              <ul className="space-y-1.5">
                {detail.tickets.map((t) => (
                  <li
                    key={t.ticketId}
                    className="flex items-center justify-between gap-3"
                  >
                    <a
                      href={t.ticketUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-sm text-brand hover:underline"
                    >
                      {t.ticketId}
                    </a>
                    <span className="text-xs text-fg-2">{t.provider}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {detail.prs.length ? (
            <Card title="Pull requests">
              <ul className="space-y-1.5">
                {detail.prs.map((p) => (
                  <li
                    key={p.prUrl}
                    className="flex items-center justify-between gap-3"
                  >
                    <a
                      href={p.prUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-sm text-brand hover:underline"
                    >
                      {p.branch}
                    </a>
                    <span className="text-xs text-fg-2">{p.provider}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-1.5 text-sm text-fg-2 transition-colors hover:text-fg-0"
    >
      <span aria-hidden="true">←</span>
      <span>Back to sessions</span>
    </Link>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-fg-2">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-fg-0">{value}</dd>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface shadow-sm">
      <header className="border-b border-line px-5 py-3">
        <h2 className="text-sm font-semibold text-fg-0">{title}</h2>
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(score * 100)));
  const tone =
    score >= 0.7 ? "bg-success" : score >= 0.4 ? "bg-warning" : "bg-fg-3";
  return (
    <div className="h-1 w-full rounded-full bg-line">
      <div
        className={`h-1 rounded-full ${tone}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
