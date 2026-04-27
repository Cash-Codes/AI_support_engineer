import { spawn } from "node:child_process";
import type { PRDraft, PRSummary } from "@ai-support/shared";
import type { Logger } from "../logger.js";

/**
 * GithubClient opens a pull request from a branch that has already been
 * pushed to the remote. This client does NOT push the branch — that step
 * happens inside the worktree before the client is invoked.
 */
export interface GithubClient {
  createPullRequest(draft: PRDraft, opts: { cwd: string }): Promise<PRSummary>;
  mode: "live" | "mock";
}

export interface CreateLiveGithubClientOptions {
  /** Optional explicit token; otherwise relies on `gh auth status`. */
  token?: string;
  logger?: Logger;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Live GitHub client. Uses the `gh` CLI to open the PR — `gh` handles
 * auth via either GH_TOKEN env or a prior `gh auth login`. Same machine
 * model as the live Claude client: spawn → wait → parse.
 */
export function createLiveGithubClient(
  opts: CreateLiveGithubClientOptions = {},
): GithubClient {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const env = opts.token
    ? { ...process.env, GH_TOKEN: opts.token }
    : process.env;

  return {
    mode: "live",
    async createPullRequest(
      draft: PRDraft,
      { cwd }: { cwd: string },
    ): Promise<PRSummary> {
      const args = [
        "pr",
        "create",
        "--title",
        draft.title,
        "--body",
        draft.body,
        "--head",
        draft.branch,
        "--base",
        draft.baseBranch,
      ];

      const { stdout } = await runGh(args, { cwd, env, timeoutMs });
      const url = stdout.trim().split("\n").pop() ?? "";
      if (!/^https?:\/\//.test(url)) {
        throw new Error(
          `gh pr create: unexpected output "${stdout.slice(0, 200)}"`,
        );
      }
      opts.logger?.info(
        { prUrl: url, branch: draft.branch },
        "github: PR opened",
      );
      return {
        prUrl: url,
        branch: draft.branch,
        provider: "github",
      };
    },
  };
}

interface RunResult {
  stdout: string;
  stderr: string;
}

function runGh(
  args: string[],
  opts: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number },
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("gh", args, { cwd: opts.cwd, env: opts.env });
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error(`gh CLI timed out after ${opts.timeoutMs}ms`));
    }, opts.timeoutMs);

    child.stdout.on("data", (c: Buffer) => stdoutChunks.push(c.toString()));
    child.stderr.on("data", (c: Buffer) => stderrChunks.push(c.toString()));

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`gh CLI failed to spawn: ${err.message}`));
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const stdout = stdoutChunks.join("");
      const stderr = stderrChunks.join("");
      if (code !== 0) {
        reject(new Error(`gh CLI exit ${code}: ${stderr.slice(0, 240)}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}
