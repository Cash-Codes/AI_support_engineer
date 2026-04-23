import type { RouterDecision } from "@ai-support/shared";
import type { CodeInvestigationResult } from "../../orchestrator/codeInvestigation.js";
import type { DocsRetrievalResult } from "../../orchestrator/docsRetrieval.js";
import type { IntakeResult } from "../../orchestrator/intake.js";

function renderDocs(retrieved: DocsRetrievalResult): string {
  if (retrieved.docs.length === 0) return "(no documentation retrieved)";
  return retrieved.docs
    .map(
      (d, i) =>
        `[${i + 1}] ${d.title}  (score ${d.score.toFixed(2)})\n${d.excerpt}`,
    )
    .join("\n\n");
}

const OUTPUT_CONTRACT_NOTE = [
  "Your response MUST end with a single ```json fenced block containing the",
  "result object. Intermediate reasoning is allowed, but the final block is",
  "what will be parsed. Do not include any text after the closing ```.",
].join(" ");

export function buildRouterPrompt(
  intake: IntakeResult,
  retrieved: DocsRetrievalResult,
): string {
  return `You are the router stage of an AI support agent. Decide whether the user's
issue can be resolved from the documentation alone, or whether it needs a
code investigation of the product repository.

# User message
${intake.originalMessage}

# Retrieved documentation (top-K semantic matches)
${renderDocs(retrieved)}

# Decision rules
- Escalate to code investigation when the docs describe symptoms but not a
  fix, or when the issue looks like a code bug (silent data loss, unexpected
  state, wrong values).
- Do not escalate when the docs clearly state the cause and a usable
  workaround — return a draftAnswer that the resolution phase can refine.
- Confidence is your self-assessed certainty about THIS routing decision.

# Output contract
${OUTPUT_CONTRACT_NOTE}

Required fields (TypeScript shape for RouterDecision):
{
  "escalate": boolean,
  "rationale": string,
  "confidence": "low" | "medium" | "high",
  "draftAnswer"?: string  // when escalate=false
}

Return only the JSON in the final \`\`\`json block.`;
}

export function buildInvestigationPrompt(
  intake: IntakeResult,
  retrieved: DocsRetrievalResult,
): string {
  return `You are the code investigation stage of an AI support agent. The router
decided the user's issue needs code-level analysis of the product repository.
Use the Read, Grep, and Glob tools (read-only) to locate the probable root
cause. Prefer reading documentation / README-like files first to orient
yourself, then drill into source.

# User message
${intake.originalMessage}

# Retrieved documentation context
${renderDocs(retrieved)}

# Guidance
- Be targeted. A handful of Grep + Read calls is usually enough.
- Identify 1–5 affected files by repository-relative path.
- Confidence reflects how certain you are about the root cause:
  - "high"  — you have strong evidence from the code
  - "medium" — a plausible cause but could not fully verify
  - "low"   — a best guess; more investigation needed
- Provide a workaround the user can try right now, even if the root cause
  is not yet conclusive.

# Output contract
${OUTPUT_CONTRACT_NOTE}

Required fields (TypeScript shape for CodeInvestigationResult):
{
  "rootCause": string,
  "affectedFiles": string[],       // repo-relative paths
  "workaround": string,
  "confidence": "low" | "medium" | "high"
}

Return only the JSON in the final \`\`\`json block.`;
}

export function buildResolutionPrompt(
  intake: IntakeResult,
  retrieved: DocsRetrievalResult,
  decision: RouterDecision,
  investigation: CodeInvestigationResult | null,
): string {
  const investigationBlock = investigation
    ? `# Code investigation findings
root cause: ${investigation.rootCause}
affected files:
${investigation.affectedFiles.map((f) => `  - ${f}`).join("\n") || "  (none)"}
workaround: ${investigation.workaround}
confidence: ${investigation.confidence}`
    : "# Code investigation\n(skipped — router resolved from docs)";

  return `You are the resolution stage of an AI support agent. Produce a concise,
user-facing explanation and workaround. Your output will be rendered in a
chat widget, so keep it direct and avoid jargon.

# User message
${intake.originalMessage}

# Router decision
escalate: ${decision.escalate}
rationale: ${decision.rationale}
${decision.draftAnswer ? `draft answer (if helpful): ${decision.draftAnswer}` : ""}

# Retrieved documentation
${renderDocs(retrieved)}

${investigationBlock}

# Guidance
- "explanation" should answer what is happening and why, in 2–4 sentences.
- "workaround" should be actionable — something the user can do right now.
- "confidence" should match the investigation's confidence if there was one,
  otherwise the router's confidence.
- "citations" should be the filenames of docs you drew from (e.g.
  "known-issues.md"), not full sentences.

# Output contract
${OUTPUT_CONTRACT_NOTE}

Required fields (TypeScript shape for ResolutionResult):
{
  "explanation": string,
  "workaround": string,
  "confidence": "low" | "medium" | "high",
  "citations": string[]
}

Return only the JSON in the final \`\`\`json block.`;
}
