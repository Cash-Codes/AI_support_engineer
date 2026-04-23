import type { RouterDecision } from "@ai-support/shared";
import type { CodeInvestigationResult } from "../orchestrator/codeInvestigation.js";
import type { DocsRetrievalResult } from "../orchestrator/docsRetrieval.js";
import type { IntakeResult } from "../orchestrator/intake.js";
import type { ResolutionResult } from "../orchestrator/resolution.js";

/**
 * ClaudeClient isolates all reasoning steps that are (eventually) powered by
 * the Claude Code CLI. Live and mock implementations share this shape so the
 * orchestrator never has to know which is wired up.
 */
export interface ClaudeClient {
  /** Fast routing decision: can docs alone resolve, or does code need inspecting? */
  route(
    intake: IntakeResult,
    retrieved: DocsRetrievalResult,
  ): Promise<RouterDecision>;

  /** Agentic code investigation with Read/Grep/Glob over the product repo. */
  investigate(
    intake: IntakeResult,
    retrieved: DocsRetrievalResult,
  ): Promise<CodeInvestigationResult>;

  /** Synthesizes the final user-facing reply from upstream phases. */
  synthesize(
    intake: IntakeResult,
    retrieved: DocsRetrievalResult,
    decision: RouterDecision,
    investigation: CodeInvestigationResult | null,
  ): Promise<ResolutionResult>;

  /** "live" when spawning the real Claude Code CLI, "mock" otherwise. */
  mode: "live" | "mock";
}

/**
 * Placeholder for the real Claude Code CLI client. The wiring follows the
 * pattern from the sibling `AI_codeme_orchestrator` repo: spawn the CLI as
 * a subprocess with read-only tools pointed at the product repo cwd, write
 * the prompt to stdin, parse a structured JSON block out of stdout.
 *
 * Implementation is scaffolded but intentionally stubbed — real CLI
 * integration is verified manually in a follow-up session. For automated
 * tests and local demo runs, the mock client is used.
 */
export function createLiveClaudeClient(_opts: {
  productRepoPath: string;
  credentialsPath: string;
}): ClaudeClient {
  return {
    mode: "live",
    async route(): Promise<RouterDecision> {
      throw new Error("live Claude CLI integration not yet implemented");
    },
    async investigate(): Promise<CodeInvestigationResult> {
      throw new Error("live Claude CLI integration not yet implemented");
    },
    async synthesize(): Promise<ResolutionResult> {
      throw new Error("live Claude CLI integration not yet implemented");
    },
  };
}
