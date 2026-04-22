import { randomUUID } from "node:crypto";
import type { TicketSummary } from "@ai-support/shared";
import type { ResolutionResult } from "./resolution.js";

/**
 * Phase stub — real Shortcut API integration lands in Phase 7.
 * Returns a mock ticket so the pipeline always produces a usable response.
 */
export async function runTicketing(
  _resolution: ResolutionResult,
): Promise<TicketSummary> {
  const id = `MOCK-${randomUUID().slice(0, 8)}`;
  return {
    ticketId: id,
    ticketUrl: `https://example.test/tickets/${id}`,
    provider: "mock",
  };
}
