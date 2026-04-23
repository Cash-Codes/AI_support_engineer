import { randomUUID } from "node:crypto";
import type {
  ChatResponse,
  PRSummary,
  PhaseEvent,
  PhaseName,
  PipelineTrace,
  RouterDecision,
  TicketSummary,
} from "@ai-support/shared";
import type { Logger } from "../logger.js";
import {
  type CodeInvestigationResult,
  runCodeInvestigation,
} from "./codeInvestigation.js";
import { type DocsRetrievalResult, runDocsRetrieval } from "./docsRetrieval.js";
import { type IntakeResult, runIntake } from "./intake.js";
import { type ResolutionResult, runResolution } from "./resolution.js";
import { runRouter } from "./router.js";
import { runTicketing } from "./ticketing.js";

export interface PipelineFlags {
  prFlow: boolean;
}

/**
 * Overrides let tests and future phases inject alternate implementations
 * without touching the orchestrator. This is the extension point that makes
 * the mock → real swap trivial.
 */
export interface PipelineOverrides {
  docsRetrieval?: (i: IntakeResult) => Promise<DocsRetrievalResult>;
  router?: (i: IntakeResult, d: DocsRetrievalResult) => Promise<RouterDecision>;
  codeInvestigation?: (
    i: IntakeResult,
    d: DocsRetrievalResult,
  ) => Promise<CodeInvestigationResult>;
  resolution?: (
    i: IntakeResult,
    d: DocsRetrievalResult,
    r: RouterDecision,
    c: CodeInvestigationResult | null,
  ) => Promise<ResolutionResult>;
  ticketing?: (r: ResolutionResult) => Promise<TicketSummary>;
  /** Returns null when the scenario has no PR (treated as skipped by the orchestrator). */
  openFixPR?: (r: ResolutionResult) => Promise<PRSummary | null>;
}

export interface PipelineContext {
  sessionId?: string;
  flags: PipelineFlags;
  emit: (event: PhaseEvent) => void;
  logger: Logger;
  overrides?: PipelineOverrides;
}

export interface PipelineInput {
  message: string;
}

export async function runPipeline(
  input: PipelineInput,
  ctx: PipelineContext,
): Promise<ChatResponse> {
  const events: PhaseEvent[] = [];
  const emit = (e: PhaseEvent) => {
    events.push(e);
    ctx.emit(e);
  };

  const timed = async <T>(
    phase: PhaseName,
    fn: () => Promise<T>,
  ): Promise<T> => {
    emit({ phase, status: "started" });
    const t0 = Date.now();
    try {
      const result = await fn();
      const durationMs = Date.now() - t0;
      emit({ phase, status: "completed", durationMs });
      ctx.logger.info(
        { sessionId: ctx.sessionId, phase, durationMs, outcome: "completed" },
        "phase completed",
      );
      return result;
    } catch (err) {
      const durationMs = Date.now() - t0;
      const summary = err instanceof Error ? err.message : String(err);
      emit({ phase, status: "failed", durationMs, summary });
      ctx.logger.error(
        { sessionId: ctx.sessionId, phase, durationMs, err: summary },
        "phase failed",
      );
      throw err;
    }
  };

  const intake = await timed("intake", async () =>
    runIntake(input, { sessionId: ctx.sessionId }),
  );

  const retrieved = await timed("docsRetrieval", async () => {
    const fn = ctx.overrides?.docsRetrieval ?? runDocsRetrieval;
    return fn(intake);
  });

  const decision = await timed("router", async () => {
    const fn = ctx.overrides?.router ?? runRouter;
    return fn(intake, retrieved);
  });

  let investigation: CodeInvestigationResult | null = null;
  if (decision.escalate) {
    investigation = await timed("codeInvestigation", async () => {
      const fn = ctx.overrides?.codeInvestigation ?? runCodeInvestigation;
      return fn(intake, retrieved);
    });
  } else {
    emit({
      phase: "codeInvestigation",
      status: "skipped",
      summary: "router resolved from docs",
    });
  }

  const resolution = await timed("resolution", async () => {
    const fn = ctx.overrides?.resolution ?? runResolution;
    return fn(intake, retrieved, decision, investigation);
  });

  let ticket: TicketSummary | undefined;
  try {
    ticket = await timed("ticketing", async () => {
      const fn = ctx.overrides?.ticketing ?? runTicketing;
      return fn(resolution);
    });
  } catch {
    // ticketing already emitted a failed event via `timed()`
  }

  let pr: PRSummary | undefined;
  if (ctx.flags.prFlow && resolution.confidence === "high") {
    if (ctx.overrides?.openFixPR) {
      try {
        const maybePR = await ctx.overrides.openFixPR(resolution);
        if (maybePR) {
          pr = maybePR;
          emit({ phase: "openFixPR", status: "completed" });
        } else {
          emit({
            phase: "openFixPR",
            status: "skipped",
            summary: "no PR available for this scenario",
          });
        }
      } catch (err) {
        // PR failure is non-fatal; pipeline still responds
        emit({
          phase: "openFixPR",
          status: "failed",
          summary: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      emit({
        phase: "openFixPR",
        status: "skipped",
        summary: "no openFixPR implementation configured",
      });
    }
  } else {
    emit({
      phase: "openFixPR",
      status: "skipped",
      summary: ctx.flags.prFlow ? "confidence not high" : "pr flow disabled",
    });
  }

  const trace: PipelineTrace = {
    events,
    retrievedDocs: retrieved.docs,
    rootCause: investigation?.rootCause,
    affectedFiles: investigation?.affectedFiles,
    confidence: resolution.confidence,
  };

  return {
    sessionId: intake.sessionId,
    assistantMessage: {
      id: randomUUID(),
      role: "assistant",
      content: `${resolution.explanation}\n\nWorkaround: ${resolution.workaround}`,
      createdAt: new Date().toISOString(),
    },
    pipeline: trace,
    ticket,
    pr,
  };
}
