import { useEffect, useMemo, useRef, useState } from "react";
import { useChatStream } from "../hooks/useChatStream.js";
import { type Suggestion, readSuggestionsFromUrl } from "../lib/api.js";
import { postToHost } from "../lib/hostBridge.js";
import { MessageBubble } from "./MessageBubble.js";
import { PhaseTimeline } from "./PhaseTimeline.js";
import { ThinkingIndicator } from "./ThinkingIndicator.js";
import { TicketCard } from "./TicketCard.js";

export function ChatWindow() {
  const { messages, phaseEvents, lastResponse, state, error, send } =
    useChatStream();
  const [draft, setDraft] = useState("");
  const [traceOpen, setTraceOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Host page passes optional suggestion chips via the loader's
  // `data-suggestions` attribute → forwarded as a query param. Empty when
  // the host doesn't configure any.
  const suggestions = useMemo(() => readSuggestionsFromUrl(), []);

  // Auto-scroll the transcript to bottom on every new message + while
  // streaming (so the thinking indicator stays in view).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (typeof el.scrollTo === "function") {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [state, lastResponse]);

  const isBusy = state === "streaming" || state === "initializing";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isBusy) return;
    setDraft("");
    setTraceOpen(false);
    await send(trimmed);
  }

  async function pickSuggestion(query: string) {
    if (isBusy) return;
    setDraft("");
    setTraceOpen(false);
    await send(query);
  }

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-7 w-7 place-items-center rounded-lg bg-slate-900 text-[11px] font-semibold text-white"
          >
            AI
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-semibold leading-none text-slate-900">
                AI Support
              </h1>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  state === "error" ? "bg-rose-500" : "bg-emerald-500"
                }`}
                aria-hidden="true"
              />
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {state === "initializing"
                ? "connecting…"
                : state === "streaming"
                  ? "looking into it…"
                  : "Typically replies in seconds"}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close chat"
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          onClick={() => postToHost({ type: "ai-support:close" })}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M2 2l10 10M12 2L2 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && state !== "streaming" ? (
          <EmptyState
            onPick={pickSuggestion}
            disabled={isBusy}
            suggestions={suggestions}
          />
        ) : null}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}

        {state === "streaming" ? (
          <div className="fade-in">
            <ThinkingIndicator events={phaseEvents} />
          </div>
        ) : null}

        {lastResponse && state === "idle" ? (
          <div className="fade-in space-y-2">
            <ResponseMeta
              confidence={lastResponse.pipeline.confidence}
              traceOpen={traceOpen}
              onToggleTrace={() => setTraceOpen((o) => !o)}
            />
            {traceOpen ? (
              <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                <PhaseTimeline events={phaseEvents} />
              </div>
            ) : null}
            {lastResponse.ticket || lastResponse.pr ? (
              <TicketCard ticket={lastResponse.ticket} pr={lastResponse.pr} />
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mx-3 mb-2 rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="flex gap-2 border-t border-slate-200 bg-white p-2.5"
      >
        <input
          className="flex-1 rounded-lg bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200 transition-shadow focus:outline-none focus:ring-2 focus:ring-slate-900"
          placeholder="Whats the issue..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={isBusy}
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-opacity disabled:opacity-50"
          disabled={isBusy || draft.trim().length === 0}
          aria-label="Send"
        >
          {state === "streaming" ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}

function EmptyState({
  onPick,
  disabled,
  suggestions,
}: {
  onPick: (q: string) => void;
  disabled: boolean;
  suggestions: Suggestion[];
}) {
  const intro =
    suggestions.length > 0
      ? "Describe a bug or unexpected behaviour and I'll check the docs and inspect the code if needed. Try one of these to start:"
      : "Describe a bug or unexpected behaviour and I'll check the docs and inspect the code if needed.";
  return (
    <div className="fade-in space-y-3 px-1 pt-2">
      <div>
        <p className="text-sm font-medium text-slate-900">Hi there 👋</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{intro}</p>
      </div>
      {suggestions.length > 0 ? (
        <ul className="space-y-1.5">
          {suggestions.map((s) => (
            <li key={s.label}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(s.query)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="font-medium text-slate-900">{s.label}</span>
                <span className="ml-2 text-slate-500">→</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const CONFIDENCE_STYLE: Record<string, string> = {
  high: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  medium: "bg-amber-50 text-amber-700 ring-amber-200",
  low: "bg-slate-100 text-slate-600 ring-slate-200",
};

function ResponseMeta({
  confidence,
  traceOpen,
  onToggleTrace,
}: {
  confidence: "low" | "medium" | "high";
  traceOpen: boolean;
  onToggleTrace: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-1">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${CONFIDENCE_STYLE[confidence]}`}
      >
        <span
          className="h-1.5 w-1.5 rounded-full bg-current"
          aria-hidden="true"
        />
        {confidence} confidence
      </span>
      <button
        type="button"
        onClick={onToggleTrace}
        className="text-[10px] font-medium uppercase tracking-wide text-slate-500 hover:text-slate-900"
      >
        {traceOpen ? "Hide trace" : "View trace"}
      </button>
    </div>
  );
}
