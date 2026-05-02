import type { PhaseEvent, PhaseName } from "@ai-support/shared";

interface Props {
  events: PhaseEvent[];
}

const PHASE_LABEL: Record<PhaseName, string> = {
  intake: "Reading your message",
  docsRetrieval: "Searching the docs",
  router: "Deciding next step",
  codeInvestigation: "Looking through code",
  resolution: "Composing the answer",
  ticketing: "Filing a ticket",
  openFixPR: "Drafting a fix",
};

export function ThinkingIndicator({ events }: Props) {
  // Show the latest phase that's "started" but not yet "completed".
  // Falls back to the most recent event when nothing is active.
  let activeLabel = "Thinking";
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.status === "started") {
      activeLabel = PHASE_LABEL[e.phase] ?? e.phase;
      break;
    }
    if (
      e.status === "completed" ||
      e.status === "skipped" ||
      e.status === "failed"
    ) {
      activeLabel = PHASE_LABEL[e.phase] ?? e.phase;
      break;
    }
  }

  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden="true"
        className="mt-1 grid h-6 w-6 flex-none place-items-center rounded-full bg-slate-900 text-[10px] text-white"
      >
        AI
      </span>
      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex gap-0.5">
            <Dot delay="0ms" />
            <Dot delay="120ms" />
            <Dot delay="240ms" />
          </span>
          <span className="text-xs text-slate-500">{activeLabel}…</span>
        </div>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="block h-1.5 w-1.5 rounded-full bg-slate-400"
      style={{
        animation: "ai-support-dot-bounce 0.9s ease-in-out infinite",
        animationDelay: delay,
      }}
    />
  );
}
