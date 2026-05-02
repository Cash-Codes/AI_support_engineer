import type { Confidence, RouterDecision } from "@ai-support/shared";
import type { Logger } from "../logger.js";
import type { CodeInvestigationResult } from "../orchestrator/codeInvestigation.js";
import type { DocsRetrievalResult } from "../orchestrator/docsRetrieval.js";
import type { IntakeResult } from "../orchestrator/intake.js";
import type { ResolutionResult } from "../orchestrator/resolution.js";
import { extractLastJsonBlock } from "./claude/parse.js";
import {
  buildInvestigationPrompt,
  buildResolutionPrompt,
  buildRouterPrompt,
} from "./claude/prompts.js";
import { spawnClaude } from "./claude/spawn.js";

const VALID_CONFIDENCE = new Set<Confidence>(["low", "medium", "high"]);

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

export interface CreateLiveClaudeClientOptions {
  productRepoPath: string;
  logger?: Logger;
  /** Override timeouts per phase (ms) - useful for tests / tight demos. */
  timeouts?: {
    router?: number;
    investigate?: number;
    synthesize?: number;
  };
}

/**
 * Live Claude Code CLI client. Each phase spawns `claude --print` as a
 * subprocess, pipes a phase-specific prompt to stdin and parses the final
 * ```json block from stdout.
 *
 * Authentication is handled by the CLI itself - it discovers OAuth
 * credentials at the standard locations (`~/.claude/.credentials.json`
 * locally, `/root/.claude/.credentials.json` when mounted into the Cloud
 * Run container). We do not inject an ANTHROPIC_API_KEY.
 */
export function createLiveClaudeClient(
  opts: CreateLiveClaudeClientOptions,
): ClaudeClient {
  const { productRepoPath, logger } = opts;
  const tRouter = opts.timeouts?.router ?? 30_000;
  const tInvestigate = opts.timeouts?.investigate ?? 120_000;
  const tSynthesize = opts.timeouts?.synthesize ?? 30_000;

  return {
    mode: "live",

    async route(intake, retrieved): Promise<RouterDecision> {
      const { stdout } = await spawnClaude({
        prompt: buildRouterPrompt(intake, retrieved),
        cwd: productRepoPath,
        allowedTools: [], // pure reasoning - no tool use
        maxTurns: 4,
        timeoutMs: tRouter,
        logger,
        tag: "router",
      });
      const parsed = extractLastJsonBlock<Partial<RouterDecision>>(stdout);
      if (!parsed.ok || !parsed.data) {
        throw new Error(`claude router: ${parsed.reason ?? "parse failed"}`);
      }
      return normalizeRouter(parsed.data);
    },

    async investigate(intake, retrieved): Promise<CodeInvestigationResult> {
      const { stdout } = await spawnClaude({
        prompt: buildInvestigationPrompt(intake, retrieved),
        cwd: productRepoPath,
        allowedTools: ["Read", "Grep", "Glob"],
        maxTurns: 30,
        timeoutMs: tInvestigate,
        logger,
        tag: "investigate",
      });
      const parsed =
        extractLastJsonBlock<Partial<CodeInvestigationResult>>(stdout);
      if (!parsed.ok || !parsed.data) {
        throw new Error(
          `claude investigate: ${parsed.reason ?? "parse failed"}`,
        );
      }
      return normalizeInvestigation(parsed.data);
    },

    async synthesize(
      intake,
      retrieved,
      decision,
      investigation,
    ): Promise<ResolutionResult> {
      const { stdout } = await spawnClaude({
        prompt: buildResolutionPrompt(
          intake,
          retrieved,
          decision,
          investigation,
        ),
        cwd: productRepoPath,
        allowedTools: [], // synthesis only - no tool use
        maxTurns: 4,
        timeoutMs: tSynthesize,
        logger,
        tag: "synthesize",
      });
      const parsed = extractLastJsonBlock<Partial<ResolutionResult>>(stdout);
      if (!parsed.ok || !parsed.data) {
        throw new Error(
          `claude synthesize: ${parsed.reason ?? "parse failed"}`,
        );
      }
      return normalizeResolution(parsed.data);
    },
  };
}

function normalizeConfidence(
  raw: unknown,
  fallback: Confidence = "low",
): Confidence {
  if (typeof raw === "string" && VALID_CONFIDENCE.has(raw as Confidence)) {
    return raw as Confidence;
  }
  return fallback;
}

function normalizeRouter(d: Partial<RouterDecision>): RouterDecision {
  return {
    escalate: Boolean(d.escalate),
    rationale: typeof d.rationale === "string" ? d.rationale : "",
    confidence: normalizeConfidence(d.confidence),
    draftAnswer: typeof d.draftAnswer === "string" ? d.draftAnswer : undefined,
  };
}

function normalizeInvestigation(
  d: Partial<CodeInvestigationResult>,
): CodeInvestigationResult {
  const affectedFiles = Array.isArray(d.affectedFiles)
    ? (d.affectedFiles as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : [];
  return {
    rootCause: typeof d.rootCause === "string" ? d.rootCause : "",
    affectedFiles,
    workaround: typeof d.workaround === "string" ? d.workaround : "",
    confidence: normalizeConfidence(d.confidence),
  };
}

function normalizeResolution(d: Partial<ResolutionResult>): ResolutionResult {
  const citations = Array.isArray(d.citations)
    ? (d.citations as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : [];
  return {
    explanation: typeof d.explanation === "string" ? d.explanation : "",
    workaround: typeof d.workaround === "string" ? d.workaround : "",
    confidence: normalizeConfidence(d.confidence),
    citations,
  };
}
