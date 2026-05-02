import type { RetrievedDoc } from "@ai-support/shared";
import type { IntakeResult } from "./intake.js";

export interface DocsRetrievalResult {
  docs: RetrievedDoc[];
}

/**
 * Phase stub - real xenova-backed retrieval lands in Phase 5.
 * Returns a single placeholder chunk so downstream phases have something to work with.
 */
export async function runDocsRetrieval(
  _intake: IntakeResult,
): Promise<DocsRetrievalResult> {
  return {
    docs: [
      {
        title: "billing.md",
        score: 0.42,
        excerpt: "[stub] real retrieval lands in Phase 5",
      },
    ],
  };
}
