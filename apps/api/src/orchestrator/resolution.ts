import type { Confidence, RouterDecision } from "@ai-support/shared";
import type { CodeInvestigationResult } from "./codeInvestigation.js";
import type { DocsRetrievalResult } from "./docsRetrieval.js";
import type { IntakeResult } from "./intake.js";

export interface ResolutionResult {
  explanation: string;
  workaround: string;
  confidence: Confidence;
  citations: string[];
}

/**
 * Phase stub - composes a final reply from the prior phases' output.
 * The real LLM synthesis lands in Phase 6.
 */
export async function runResolution(
  intake: IntakeResult,
  _retrieved: DocsRetrievalResult,
  decision: RouterDecision,
  investigation: CodeInvestigationResult | null,
): Promise<ResolutionResult> {
  if (investigation) {
    return {
      explanation:
        `I looked into "${intake.normalized}". ` +
        `Probable root cause: ${investigation.rootCause}`,
      workaround: investigation.workaround,
      confidence: investigation.confidence,
      citations: investigation.affectedFiles,
    };
  }
  return {
    explanation:
      decision.draftAnswer ??
      `I looked into "${intake.normalized}" using the documentation.`,
    workaround: "Check the related docs for current configuration guidance.",
    confidence: decision.confidence,
    citations: [],
  };
}
