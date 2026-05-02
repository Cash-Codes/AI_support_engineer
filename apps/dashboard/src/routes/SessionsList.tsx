import type { SessionSummary } from "@ai-support/shared";
import { useEffect, useState } from "react";
import { SessionRow } from "../components/SessionRow.js";
import { fetchSessions } from "../lib/api.js";

const POLL_INTERVAL_MS = 5000;

export function SessionsList() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const list = await fetchSessions();
        if (!cancelled) {
          setSessions(list);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const withTicket = sessions.filter((s) => s.hasTicket).length;
  const withPR = sessions.filter((s) => s.hasPR).length;

  return (
    <div className="space-y-6 fade-in">
      <header className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg-0">
            Sessions
          </h1>
          <p className="mt-1 text-sm text-fg-2">
            Chat sessions initiated from the widget. Polling every 5 seconds.
          </p>
        </div>
        <dl className="flex items-end gap-8">
          <Metric label="Total" value={sessions.length} />
          <Metric label="With ticket" value={withTicket} />
          <Metric label="With PR" value={withPR} />
        </dl>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-danger/40 bg-danger-weak px-4 py-3"
        >
          <p className="text-sm font-medium text-danger">
            Unable to load sessions
          </p>
          <p className="mt-0.5 font-mono text-xs text-fg-1">{error}</p>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_120px_120px_100px_24px] items-center gap-4 border-b border-line bg-canvas px-6 py-2.5 text-[11px] font-medium uppercase tracking-wider text-fg-2">
          <span>Session</span>
          <span>Confidence</span>
          <span>Outputs</span>
          <span>Last active</span>
          <span aria-hidden="true" />
        </div>

        {loading ? (
          <div className="px-6 py-10 text-center text-sm text-fg-2">
            Loading sessions…
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <ul>
            {sessions.map((s) => (
              <li key={s.sessionId}>
                <SessionRow session={s} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-fg-2">
        {label}
      </dt>
      <dd className="mt-0.5 text-2xl font-semibold tracking-tight text-fg-0 tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-sm font-medium text-fg-0">No sessions yet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-fg-2">
        Start a conversation from the widget and it will appear here within a
        few seconds.
      </p>
    </div>
  );
}
