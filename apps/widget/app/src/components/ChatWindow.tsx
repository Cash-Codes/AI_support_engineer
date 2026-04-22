import { useState } from "react";
import { useChatStream } from "../hooks/useChatStream.js";
import { postToHost } from "../lib/hostBridge.js";
import { MessageBubble } from "./MessageBubble.js";
import { PhaseTimeline } from "./PhaseTimeline.js";
import { TicketCard } from "./TicketCard.js";

export function ChatWindow() {
  const { messages, phaseEvents, lastResponse, state, error, send } =
    useChatStream();
  const [draft, setDraft] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || state === "streaming" || state === "initializing") return;
    setDraft("");
    await send(trimmed);
  }

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
        <div>
          <h1 className="text-sm font-semibold text-slate-900">
            AI Support Engineer
          </h1>
          <p className="text-[11px] text-slate-500">
            {state === "initializing" ? "connecting..." : "Describe your issue"}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close chat"
          className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-100"
          onClick={() => postToHost({ type: "ai-support:close" })}
        >
          ✕
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-slate-400">
            How can I help! start by describing your issue.
          </p>
        ) : null}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}

        {phaseEvents.length > 0 ? (
          <div className="space-y-1">
            <h2 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Phases
            </h2>
            <PhaseTimeline events={phaseEvents} />
          </div>
        ) : null}

        {lastResponse?.ticket || lastResponse?.pr ? (
          <TicketCard ticket={lastResponse.ticket} pr={lastResponse.pr} />
        ) : null}
      </div>

      {error ? (
        <p className="mx-3 mb-2 rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="flex gap-2 border-t border-slate-200 bg-white p-2"
      >
        <input
          className="flex-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
          placeholder="Whats the issue..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={state === "streaming" || state === "initializing"}
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          disabled={
            state === "streaming" ||
            state === "initializing" ||
            draft.trim().length === 0
          }
        >
          {state === "streaming" ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}
