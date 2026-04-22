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

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Sessions
      </h2>
      {error ? (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-slate-400">
          No sessions yet. Start one from the widget and it will appear here.
        </p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.sessionId}>
              <SessionRow session={s} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
