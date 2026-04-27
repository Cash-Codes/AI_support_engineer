import type { TicketDraft } from "@ai-support/shared";
import type { CodeInvestigationResult } from "./codeInvestigation.js";
import type { IntakeResult } from "./intake.js";
import type { ResolutionResult } from "./resolution.js";

export interface ComposeTicketInput {
  intake: IntakeResult;
  resolution: ResolutionResult;
  investigation: CodeInvestigationResult | null;
  /** Optional fixture-authored title/body — wins over the composed default. */
  preformed?: { title: string; body: string };
}

/**
 * Builds a structured ticket draft from pipeline outputs. Used by both the
 * live Shortcut client (which POSTs the draft) and the mock client (which
 * just echoes an identity). Pure function — trivial to unit test.
 */
export function composeTicket(input: ComposeTicketInput): TicketDraft {
  const { intake, resolution, investigation, preformed } = input;

  const labels = [
    "support-agent",
    `confidence-${resolution.confidence}`,
    investigation ? "code-investigated" : "docs-only",
  ];

  if (preformed) {
    return {
      title: preformed.title,
      body: preformed.body,
      storyType: "bug",
      labels,
    };
  }

  const title = buildTitle(intake);
  const body = buildBody(intake, resolution, investigation);

  return { title, body, storyType: "bug", labels };
}

function buildTitle(intake: IntakeResult): string {
  const head = intake.normalized.slice(0, 90).trim();
  return `Support: ${head}${intake.normalized.length > 90 ? "…" : ""}`;
}

function buildBody(
  intake: IntakeResult,
  resolution: ResolutionResult,
  investigation: CodeInvestigationResult | null,
): string {
  const sections: string[] = [];

  sections.push(
    `## Reported issue\n\n> ${truncate(intake.originalMessage, 1500)}`,
  );

  sections.push(`## Agent analysis\n\n${resolution.explanation}`);

  if (investigation) {
    sections.push(`## Probable root cause\n\n${investigation.rootCause}`);
    if (investigation.affectedFiles.length > 0) {
      const list = investigation.affectedFiles
        .map((f) => `- \`${f}\``)
        .join("\n");
      sections.push(`## Affected files\n\n${list}`);
    }
  }

  sections.push(`## Workaround\n\n${resolution.workaround}`);

  if (resolution.citations.length > 0) {
    const list = resolution.citations.map((c) => `- ${c}`).join("\n");
    sections.push(`## Referenced docs\n\n${list}`);
  }

  sections.push(
    `## Metadata\n\n- Confidence: **${resolution.confidence}**\n- Session: \`${intake.sessionId}\``,
  );

  return sections.join("\n\n");
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}
