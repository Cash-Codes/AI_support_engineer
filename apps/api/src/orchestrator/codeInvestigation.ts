import type { Confidence } from "@ai-support/shared";
import type { DocsRetrievalResult } from "./docsRetrieval.js";
import type { IntakeResult } from "./intake.js";

export interface CodeInvestigationResult {
  rootCause: string;
  affectedFiles: string[];
  workaround: string;
  confidence: Confidence;
}

/**
 * Phase stub - real Claude Code CLI spawn lands in Phase 6.
 */
export async function runCodeInvestigation(
  _intake: IntakeResult,
  _retrieved: DocsRetrievalResult,
): Promise<CodeInvestigationResult> {
  return {
    rootCause: "[stub] code investigation lands in Phase 6",
    affectedFiles: [],
    workaround: "No workaround yet - stub response.",
    confidence: "low",
  };
}
