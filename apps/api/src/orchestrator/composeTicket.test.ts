import { describe, expect, it } from "vitest";
import type { CodeInvestigationResult } from "./codeInvestigation.js";
import { composeTicket } from "./composeTicket.js";
import type { IntakeResult } from "./intake.js";
import type { ResolutionResult } from "./resolution.js";

const intake: IntakeResult = {
  sessionId: "s-abc",
  normalized: "my basket is empty on tesco after pushing",
  originalMessage: "my basket is empty on Tesco after pushing!",
};

const resolution: ResolutionResult = {
  explanation: "Expired retailer session.",
  workaround: "Reconnect Tesco and retry.",
  confidence: "high",
  citations: ["known-issues.md", "troubleshooting.md"],
};

const investigation: CodeInvestigationResult = {
  rootCause: "tesco.ts treats 200-empty as success.",
  affectedFiles: ["src/retailers/tesco.ts", "src/retailers/asda.ts"],
  workaround: "Reconnect.",
  confidence: "high",
};

describe("composeTicket", () => {
  it("uses preformed title+body when provided and keeps labels", () => {
    const draft = composeTicket({
      intake,
      resolution,
      investigation,
      preformed: { title: "PREFORMED TITLE", body: "PREFORMED BODY" },
    });
    expect(draft.title).toBe("PREFORMED TITLE");
    expect(draft.body).toBe("PREFORMED BODY");
    expect(draft.storyType).toBe("bug");
    expect(draft.labels).toContain("support-agent");
    expect(draft.labels).toContain("confidence-high");
    expect(draft.labels).toContain("code-investigated");
  });

  it("composes title + body from pipeline outputs when no preformed", () => {
    const draft = composeTicket({ intake, resolution, investigation });
    expect(draft.title.startsWith("Support: ")).toBe(true);
    expect(draft.title).toContain("basket is empty");
    expect(draft.body).toContain("## Reported issue");
    expect(draft.body).toContain("my basket is empty on Tesco");
    expect(draft.body).toContain("## Probable root cause");
    expect(draft.body).toContain("tesco.ts treats 200-empty");
    expect(draft.body).toContain("## Affected files");
    expect(draft.body).toContain("`src/retailers/tesco.ts`");
    expect(draft.body).toContain("## Workaround");
    expect(draft.body).toContain("## Referenced docs");
    expect(draft.body).toContain("known-issues.md");
    expect(draft.body).toContain("## Metadata");
    expect(draft.body).toContain("Confidence: **high**");
    expect(draft.body).toContain("`s-abc`");
  });

  it("uses docs-only label when investigation is null", () => {
    const draft = composeTicket({ intake, resolution, investigation: null });
    expect(draft.labels).toContain("docs-only");
    expect(draft.labels).not.toContain("code-investigated");
    expect(draft.body).not.toContain("## Probable root cause");
    expect(draft.body).not.toContain("## Affected files");
  });

  it("truncates long reported-issue text with an ellipsis", () => {
    const long = "x".repeat(2000);
    const draft = composeTicket({
      intake: { ...intake, originalMessage: long, normalized: long },
      resolution,
      investigation: null,
    });
    expect(draft.body).toMatch(/…$|…\n/m);
    expect(draft.body.length).toBeLessThan(long.length);
  });
});
