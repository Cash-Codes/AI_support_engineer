import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadFixtures } from "../fixtures/index.js";
import type { DocsRetrievalResult } from "../orchestrator/docsRetrieval.js";
import type { IntakeResult } from "../orchestrator/intake.js";
import { createMockClaudeClient } from "./claude.mock.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "claude-mock-"));
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function write(fixture: unknown, name = "f.json") {
  await fs.writeFile(path.join(tmp, name), JSON.stringify(fixture), "utf8");
}

function intake(message: string): IntakeResult {
  return { sessionId: "s", normalized: message, originalMessage: message };
}

const noDocs: DocsRetrievalResult = { docs: [] };

describe("createMockClaudeClient", () => {
  it("returns the matched fixture's router/investigation/resolution fields", async () => {
    await write({
      slug: "match",
      keywords: ["refund"],
      router: { escalate: true, rationale: "code needed", confidence: "high" },
      codeInvestigation: {
        rootCause: "bug X",
        affectedFiles: ["a.ts"],
        workaround: "toggle",
        confidence: "high",
      },
      resolution: {
        explanation: "fix is this",
        workaround: "do that",
        confidence: "high",
        citations: ["known-issues.md"],
      },
    });
    const client = createMockClaudeClient(await loadFixtures(tmp));

    const r = await client.route(intake("my refund is missing"), noDocs);
    expect(r.escalate).toBe(true);
    expect(r.confidence).toBe("high");

    const inv = await client.investigate(
      intake("my refund is missing"),
      noDocs,
    );
    expect(inv.rootCause).toBe("bug X");
    expect(inv.affectedFiles).toEqual(["a.ts"]);

    const res = await client.synthesize(
      intake("my refund is missing"),
      noDocs,
      r,
      inv,
    );
    expect(res.explanation).toBe("fix is this");
    expect(res.citations).toContain("known-issues.md");
  });

  it("falls back to the generic no-match fixture when no keyword matches", async () => {
    await write({
      slug: "x",
      keywords: ["unrelated"],
      router: { escalate: true, rationale: "", confidence: "high" },
      resolution: {
        explanation: "",
        workaround: "",
        confidence: "high",
        citations: [],
      },
    });
    const client = createMockClaudeClient(await loadFixtures(tmp));
    const r = await client.route(intake("totally different query"), noDocs);
    expect(r.escalate).toBe(false);
    expect(r.confidence).toBe("low");
  });

  it("returns a sensible investigation default when the matched fixture has no codeInvestigation", async () => {
    await write({
      slug: "docs-only",
      keywords: ["docs"],
      router: {
        escalate: false,
        rationale: "docs cover it",
        confidence: "high",
        draftAnswer: "here's your answer",
      },
      resolution: {
        explanation: "clear answer",
        workaround: "—",
        confidence: "high",
        citations: [],
      },
    });
    const client = createMockClaudeClient(await loadFixtures(tmp));
    const inv = await client.investigate(intake("docs question here"), noDocs);
    expect(inv.confidence).toBe("low");
    expect(inv.rootCause).toMatch(/mock fallback/i);
  });

  it("is deterministic — same input produces same output", async () => {
    await write({
      slug: "d",
      keywords: ["deterministic"],
      router: { escalate: true, rationale: "x", confidence: "medium" },
      resolution: {
        explanation: "x",
        workaround: "x",
        confidence: "medium",
        citations: [],
      },
    });
    const client = createMockClaudeClient(await loadFixtures(tmp));
    const a = await client.route(intake("a deterministic query"), noDocs);
    const b = await client.route(intake("a deterministic query"), noDocs);
    expect(a).toEqual(b);
  });
});
