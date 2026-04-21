import type { PhaseEvent, PhaseName, PhaseStatus } from "@ai-support/shared";

interface Props {
  events: PhaseEvent[];
}

const STATUS_STYLES: Record<PhaseStatus, string> = {
  started: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  skipped: "bg-slate-100 text-slate-500",
  failed: "bg-rose-100 text-rose-700",
};

export function PhaseTimeline({ events }: Props) {
  if (events.length === 0) {
    return <p className="text-xs italic text-slate-400">no phases yet</p>;
  }

  const latestByPhase = new Map<PhaseName, PhaseEvent>();
  for (const e of events) latestByPhase.set(e.phase, e);

  return (
    <ul className="space-y-1">
      {Array.from(latestByPhase.values()).map((e) => (
        <li
          key={e.phase}
          className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1 text-[11px] ring-1 ring-slate-200"
        >
          <span className="font-mono text-slate-700">{e.phase}</span>
          <span className={`rounded px-1.5 py-0.5 ${STATUS_STYLES[e.status]}`}>
            {e.status}
            {e.durationMs !== undefined ? ` · ${e.durationMs}ms` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
