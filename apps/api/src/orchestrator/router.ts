import type { RouterDecision } from "@ai-support/shared";
import type { DocsRetrievalResult } from "./docsRetrieval.js";
import type { IntakeResult } from "./intake.js";

/**
 * Phase stub - real LLM routing lands in Phase 6.
 * Default behavior: always escalate to code investigation so the full pipeline
 * exercises every downstream phase during v1 development.
 */
export async function runRouter(
  _intake: IntakeResult,
  _retrieved: DocsRetrievalResult,
): Promise<RouterDecision> {
  return {
    escalate: true,
    rationale: "[stub] always escalates until Phase 6",
    confidence: "low",
  };
}
