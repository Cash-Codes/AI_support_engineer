import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Confidence,
  PRSummary,
  RouterDecision,
  TicketSummary,
} from "@ai-support/shared";
import type { CodeInvestigationResult } from "../orchestrator/codeInvestigation.js";
import type { ResolutionResult } from "../orchestrator/resolution.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Default location: repo-root `fixtures/mock-responses/`. This package
// itself ships no fixtures - the directory is empty out of the box.
// Cloud-Run-style demos can point `FIXTURES_DIR` at a product-specific
// fixtures folder (e.g. `/path/to/pulsefile/fixtures/mock-responses`).
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const DEFAULT_FIXTURES_DIR = path.resolve(REPO_ROOT, "fixtures/mock-responses");

export interface Fixture {
  slug: string;
  keywords: string[];
  router: RouterDecision;
  codeInvestigation?: CodeInvestigationResult;
  resolution: ResolutionResult;
  ticket?: {
    title: string;
    body: string;
  };
  pr?: {
    branch: string;
    title: string;
    summary: string;
  };
}

export interface FixtureLibrary {
  match(normalizedMessage: string): Fixture | undefined;
  all(): Fixture[];
  fallback(): Fixture;
}

/**
 * Generic fallback when no fixture matches and no live LLM is configured.
 * Used by the Cloud-Run-style demo deploy where Claude credentials aren't
 * mounted - keeps the pipeline honest about what's running.
 */
const FALLBACK: Fixture = {
  slug: "no-match",
  keywords: [],
  router: {
    escalate: false,
    rationale: "No matching fixture and no live LLM is configured.",
    confidence: "low",
    draftAnswer:
      "This support agent is running in demo mode without a live LLM connected, so I can't fully investigate your question. In a deployed setup with Claude credentials available, I would search the docs, run a code investigation if needed and respond with a workaround plus an optional ticket and PR.",
  },
  resolution: {
    explanation:
      "Running in demo mode - no live LLM is connected, so this response is a generic placeholder. With credentials configured, the agent would synthesize a real answer from your docs and (if needed) code.",
    workaround:
      "Try one of the suggested questions if your host page provided any, or run the agent locally with `claude login` and the relevant integration tokens to see the live pipeline.",
    confidence: "low" as Confidence,
    citations: [],
  },
};

export async function loadFixtures(
  dir: string = DEFAULT_FIXTURES_DIR,
): Promise<FixtureLibrary> {
  const fixtures = await readFixturesFromDir(dir);
  return {
    match(normalizedMessage: string): Fixture | undefined {
      const haystack = normalizedMessage.toLowerCase();
      for (const f of fixtures) {
        for (const k of f.keywords) {
          if (haystack.includes(k.toLowerCase())) return f;
        }
      }
      return undefined;
    },
    all(): Fixture[] {
      return fixtures.slice();
    },
    fallback(): Fixture {
      return FALLBACK;
    },
  };
}

async function readFixturesFromDir(dir: string): Promise<Fixture[]> {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: Fixture[] = [];
  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    const raw = await fs.readFile(path.join(dir, name), "utf8");
    const parsed = JSON.parse(raw) as Fixture;
    if (!parsed.slug || !Array.isArray(parsed.keywords)) {
      throw new Error(`invalid fixture ${name}: missing slug or keywords`);
    }
    out.push(parsed);
  }
  out.sort((a, b) => a.slug.localeCompare(b.slug));
  return out;
}

export function buildMockTicket(fixture: Fixture): TicketSummary {
  const id = `MOCK-${fixture.slug.toUpperCase().slice(0, 10)}`;
  return {
    ticketId: id,
    ticketUrl: `https://example.test/tickets/${id}`,
    provider: "mock",
  };
}

export function buildMockPR(fixture: Fixture): PRSummary | undefined {
  if (!fixture.pr) return undefined;
  return {
    prUrl: `https://example.test/pr/${fixture.pr.branch}`,
    branch: fixture.pr.branch,
    provider: "mock",
  };
}
