import { randomUUID } from "node:crypto";
import type { TicketSummary } from "@ai-support/shared";
import type { CodeInvestigationResult } from "./codeInvestigation.js";
import type { IntakeResult } from "./intake.js";
import type { ResolutionResult } from "./resolution.js";

/**
 * Default (fallback) ticketing implementation — returns a mock ticket.
 * The real flow passes a `ticketing` override built around a ShortcutClient
 * plus composeTicket(); this stub only runs when no override is wired.
 */
export async function runTicketing(
  _resolution: ResolutionResult,
  _investigation: CodeInvestigationResult | null,
  _intake: IntakeResult,
): Promise<TicketSummary> {
  const id = `MOCK-${randomUUID().slice(0, 8)}`;
  return {
    ticketId: id,
    ticketUrl: `https://example.test/tickets/${id}`,
    provider: "mock",
  };
}
