import type { PRDraft, PRSummary } from "@ai-support/shared";
import { extractLastJsonBlock } from "../../clients/claude/parse.js";
import { spawnClaude } from "../../clients/claude/spawn.js";
import type { GithubClient } from "../../clients/github.js";
import type { Logger } from "../../logger.js";
import type { CodeInvestigationResult } from "../codeInvestigation.js";
import type { IntakeResult } from "../intake.js";
import type { ResolutionResult } from "../resolution.js";
import {
  type FixOutput,
  buildFixPrompt,
  normalizeFixOutput,
} from "./prompts.js";
import {
  type WorktreeHandle,
  createWorktree,
  removeWorktree,
} from "./worktree.js";

export interface OpenFixPROptions {
  /** Absolute path to the product repo (with .git + a working remote). */
  productRepoPath: string;
  baseBranch?: string;
  github: GithubClient;
  logger?: Logger;
  /** Override timeouts (ms). Defaults: edit=300_000. */
  timeouts?: { edit?: number };
  /** Slug used in the branch name (snake-case-friendly). */
  slug?: string;
}

export interface OpenFixPRInput {
  intake: IntakeResult;
  resolution: ResolutionResult;
  investigation: CodeInvestigationResult;
}

/**
 * Composes the full fix-and-PR flow:
 *   1. Create a fresh worktree on a new branch
 *   2. Spawn Claude with Read/Write/Edit/Bash(git *) inside that worktree
 *   3. Parse the agent's outcome — bail if it didn't make changes
 *   4. Open a PR via the GithubClient
 *   5. Always clean up the worktree (success or failure)
 *
 * Returns null when the agent reported no_changes (treated by the
 * orchestrator as a clean "skipped"). Throws on infrastructure failures
 * — orchestrator surfaces those as `openFixPR: failed`.
 */
export async function runOpenFixPR(
  input: OpenFixPRInput,
  opts: OpenFixPROptions,
): Promise<PRSummary | null> {
  const slug = opts.slug ?? deriveSlug(input.intake.normalized);
  const baseBranch = opts.baseBranch ?? "main";

  let worktree: WorktreeHandle | undefined;
  try {
    worktree = await createWorktree({
      repoPath: opts.productRepoPath,
      slug,
      baseBranch,
      logger: opts.logger,
    });

    const fix = await runFixAgent({
      worktree,
      input,
      logger: opts.logger,
      timeoutMs: opts.timeouts?.edit ?? 300_000,
    });

    if (fix.outcome !== "success" || fix.files_changed.length === 0) {
      opts.logger?.warn(
        { outcome: fix.outcome, summary: fix.summary },
        "openFixPR: agent did not produce a usable fix",
      );
      return null;
    }

    const draft: PRDraft = {
      branch: worktree.branch,
      baseBranch,
      title: fix.commit_message || `fix: ${slug}`,
      body: composePRBody({ input, fix }),
    };

    const pr = await opts.github.createPullRequest(draft, {
      cwd: worktree.path,
    });
    opts.logger?.info(
      { prUrl: pr.prUrl, branch: pr.branch },
      "openFixPR: PR opened",
    );
    return pr;
  } finally {
    if (worktree) {
      await removeWorktree(opts.productRepoPath, worktree, opts.logger);
    }
  }
}

interface RunFixAgentArgs {
  worktree: WorktreeHandle;
  input: OpenFixPRInput;
  logger?: Logger;
  timeoutMs: number;
}

async function runFixAgent(args: RunFixAgentArgs): Promise<FixOutput> {
  const { stdout } = await spawnClaude({
    prompt: buildFixPrompt({
      intake: args.input.intake,
      investigation: args.input.investigation,
      resolution: args.input.resolution,
      branch: args.worktree.branch,
    }),
    cwd: args.worktree.path,
    allowedTools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash(git *)"],
    maxTurns: 60,
    timeoutMs: args.timeoutMs,
    logger: args.logger,
    tag: "fix-agent",
  });
  const parsed = extractLastJsonBlock<Partial<FixOutput>>(stdout);
  if (!parsed.ok || !parsed.data) {
    throw new Error(`fix agent: ${parsed.reason ?? "parse failed"}`);
  }
  return normalizeFixOutput(parsed.data);
}

function composePRBody(args: {
  input: OpenFixPRInput;
  fix: FixOutput;
}): string {
  const sections: string[] = [];
  sections.push(`## Reported issue\n\n> ${args.input.intake.originalMessage}`);
  sections.push(`## Root cause\n\n${args.input.investigation.rootCause}`);
  if (args.fix.files_changed.length > 0) {
    const list = args.fix.files_changed.map((f) => `- \`${f}\``).join("\n");
    sections.push(`## Files changed\n\n${list}`);
  }
  sections.push(`## Summary\n\n${args.fix.summary}`);
  sections.push(
    `---\n_Opened by AI Support Engineer · session \`${args.input.intake.sessionId}\`_`,
  );
  return sections.join("\n\n");
}

function deriveSlug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "support-fix"
  );
}
