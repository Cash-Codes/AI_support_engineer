import type { RouterDecision } from "@ai-support/shared";
import type { Fixture, FixtureLibrary } from "../fixtures/index.js";
import type { CodeInvestigationResult } from "../orchestrator/codeInvestigation.js";
import type { IntakeResult } from "../orchestrator/intake.js";
import type { ResolutionResult } from "../orchestrator/resolution.js";
import type { ClaudeClient } from "./claude.js";

/**
 * Mock Claude client backed by the fixture library. On each pipeline phase,
 * looks up the fixture that matches the intake message (keyword match) and
 * returns the corresponding field. Falls back to a generic response when
 * no fixture matches.
 *
 * This is deliberately deterministic — same input always produces the same
 * output — so demos and tests are reproducible.
 */
export function createMockClaudeClient(fixtures: FixtureLibrary): ClaudeClient {
  const resolveFixture = (intake: IntakeResult): Fixture =>
    fixtures.match(intake.normalized) ?? fixtures.fallback();

  return {
    mode: "mock",

    async route(intake: IntakeResult): Promise<RouterDecision> {
      return resolveFixture(intake).router;
    },

    async investigate(intake: IntakeResult): Promise<CodeInvestigationResult> {
      const fix = resolveFixture(intake);
      if (fix.codeInvestigation) return fix.codeInvestigation;
      // Fixture without explicit investigation → a thin, honest default.
      return {
        rootCause:
          "No code investigation scenario is wired for this query; this is a mock fallback.",
        affectedFiles: [],
        workaround:
          "Try reproducing the issue with a concrete example and re-submit.",
        confidence: "low",
      };
    },

    async synthesize(intake: IntakeResult): Promise<ResolutionResult> {
      return resolveFixture(intake).resolution;
    },
  };
}
