import type { PRSummary, TicketSummary } from "@ai-support/shared";

interface Props {
  ticket?: TicketSummary;
  pr?: PRSummary;
}

export function TicketCard({ ticket, pr }: Props) {
  if (!ticket && !pr) return null;
  return (
    <div className="space-y-1.5 rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
      {ticket ? (
        <a
          href={ticket.ticketUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between text-xs"
        >
          <span className="font-medium text-slate-700">
            Ticket {ticket.ticketId}
          </span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
            {ticket.provider}
          </span>
        </a>
      ) : null}
      {pr ? (
        <a
          href={pr.prUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between text-xs"
        >
          <span className="font-medium text-slate-700">PR · {pr.branch}</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
            {pr.provider}
          </span>
        </a>
      ) : null}
    </div>
  );
}
