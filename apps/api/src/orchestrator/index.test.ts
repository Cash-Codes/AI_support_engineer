import type { PhaseEvent } from "@ai-support/shared";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { runPipeline } from "./index.js";

const silentLogger = pino({ level: "silent" });

describe("runPipeline", () => {
  it("runs every phase with stubs and returns a ChatResponse with a mock ticket", async () => {
    const events: PhaseEvent[] = [];
    const res = await runPipeline(
      { message: "my refund didn't arrive" },
      {
        sessionId: "s-test",
        flags: { prFlow: false },
        emit: (e) => events.push(e),
        logger: silentLogger,
      },
    );

    expect(res.sessionId).toBe("s-test");
    expect(res.assistantMessage.role).toBe("assistant");
    expect(res.assistantMessage.content).toContain("refund");
    expect(res.ticket?.provider).toBe("mock");
    expect(res.pr).toBeUndefined();

    const phases = events.map((e) => `${e.phase}:${e.status}`);
    expect(phases).toContain("intake:completed");
    expect(phases).toContain("docsRetrieval:completed");
    expect(phases).toContain("router:completed");
    expect(phases).toContain("codeInvestigation:completed");
    expect(phases).toContain("resolution:completed");
    expect(phases).toContain("ticketing:completed");
    expect(phases).toContain("openFixPR:skipped");
  });

  it("skips codeInvestigation when router override does not escalate", async () => {
    const events: PhaseEvent[] = [];
    await runPipeline(
      { message: "session timeout" },
      {
        sessionId: "s-test",
        flags: { prFlow: false },
        emit: (e) => events.push(e),
        logger: silentLogger,
        overrides: {
          router: async () => ({
            escalate: false,
            rationale: "resolved from docs",
            confidence: "high",
            draftAnswer: "Your session expires after 15 minutes by default.",
          }),
        },
      },
    );

    const phases = events.map((e) => `${e.phase}:${e.status}`);
    expect(phases).toContain("codeInvestigation:skipped");
    expect(phases).not.toContain("codeInvestigation:completed");
  });

  it("marks ticketing as failed but still returns a response", async () => {
    const events: PhaseEvent[] = [];
    const res = await runPipeline(
      { message: "bug" },
      {
        sessionId: "s-test",
        flags: { prFlow: false },
        emit: (e) => events.push(e),
        logger: silentLogger,
        overrides: {
          ticketing: async () => {
            throw new Error("shortcut down");
          },
        },
      },
    );

    const phases = events.map((e) => `${e.phase}:${e.status}`);
    expect(phases).toContain("ticketing:failed");
    expect(res.ticket).toBeUndefined();
    expect(res.assistantMessage.content.length).toBeGreaterThan(0);
  });

  it("opens a PR when prFlow is on, confidence is high, and override is provided", async () => {
    const events: PhaseEvent[] = [];
    const res = await runPipeline(
      { message: "refund bug" },
      {
        sessionId: "s-test",
        flags: { prFlow: true },
        emit: (e) => events.push(e),
        logger: silentLogger,
        overrides: {
          codeInvestigation: async () => ({
            rootCause: "filter excludes refunds",
            affectedFiles: ["BillingHistory.svelte"],
            workaround: "Refresh and toggle filter",
            confidence: "high",
          }),
          openFixPR: async () => ({
            prUrl: "https://github.com/example/product/pull/42",
            branch: "fix/billing-refund",
            provider: "github",
          }),
        },
      },
    );

    expect(res.pr?.provider).toBe("github");
    const phases = events.map((e) => `${e.phase}:${e.status}`);
    expect(phases).toContain("openFixPR:completed");
  });
});
