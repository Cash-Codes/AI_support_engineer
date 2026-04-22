import type { PhaseEvent, PhaseName, PhaseStatus } from "@ai-support/shared";

interface Props {
  events: PhaseEvent[];
}

const STATUS_STYLE: Record<PhaseStatus, { dot: string; text: string }> = {
  started: { dot: "bg-info", text: "text-info" },
  completed: { dot: "bg-success", text: "text-success" },
  skipped: { dot: "bg-fg-3", text: "text-fg-2" },
  failed: { dot: "bg-danger", text: "text-danger" },
};

const PHASE_LABEL: Record<PhaseName, string> = {
  intake: "Intake",
  docsRetrieval: "Docs retrieval",
  router: "Router",
  codeInvestigation: "Code investigation",
  resolution: "Resolution",
  ticketing: "Ticketing",
  openFixPR: "Pull request",
};

const PHASE_ORDER: PhaseName[] = [
  "intake",
  "docsRetrieval",
  "router",
  "codeInvestigation",
  "resolution",
  "ticketing",
  "openFixPR",
];

export function PhaseTimeline({ events }: Props) {
  if (events.length === 0) {
    return <p className="text-sm text-fg-2">No phases recorded.</p>;
  }

  const latestByPhase = new Map<PhaseName, PhaseEvent>();
  for (const e of events) latestByPhase.set(e.phase, e);

  const nodes = PHASE_ORDER.filter((p) => latestByPhase.has(p)).map((p) => {
    const event = latestByPhase.get(p);
    if (!event) throw new Error("unreachable");
    return { phase: p, event };
  });

  return (
    <ol className="space-y-2">
      {nodes.map(({ phase, event }, i) => {
        const style = STATUS_STYLE[event.status];
        const isLast = i === nodes.length - 1;
        return (
          <li key={phase} className="relative flex gap-3">
            {!isLast ? (
              <span
                aria-hidden="true"
                className="absolute bottom-[-8px] left-[5px] top-3 w-px bg-line"
              />
            ) : null}
            <span
              className={`relative z-10 mt-1.5 h-[11px] w-[11px] flex-none rounded-full ring-2 ring-surface ${style.dot}`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-fg-0">
                  {PHASE_LABEL[phase]}
                </span>
                <span className="font-mono text-xs tabular-nums text-fg-2">
                  {event.durationMs !== undefined
                    ? `${event.durationMs}ms`
                    : "—"}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className={`text-xs ${style.text}`}>{event.status}</span>
                <span className="font-mono text-[10px] text-fg-3">{phase}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
