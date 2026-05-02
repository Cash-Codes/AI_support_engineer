import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Logger } from "../../logger.js";

export interface WorktreeHandle {
  /** Absolute path to the new worktree's working directory. */
  path: string;
  /** Branch name created in the worktree. */
  branch: string;
}

export interface CreateWorktreeOptions {
  /** Absolute path to the source repo. */
  repoPath: string;
  /** Slug used to name the branch (e.g. "basket-push-fix"). */
  slug: string;
  /** Base branch to fork from - defaults to "main". */
  baseBranch?: string;
  /** Override the parent dir for the worktree (defaults to OS temp). */
  parentDir?: string;
  logger?: Logger;
}

/**
 * Creates a fresh git worktree off the given repo at a new branch. Returns
 * a handle the caller MUST clean up with `removeWorktree`.
 *
 * Worktrees give us an isolated working directory whose changes don't
 * affect the user's checkout - exactly what we need for an autonomous
 * agent to make edits without stepping on the dev's working tree.
 */
export async function createWorktree(
  opts: CreateWorktreeOptions,
): Promise<WorktreeHandle> {
  const baseBranch = opts.baseBranch ?? "main";
  const parentDir = opts.parentDir ?? os.tmpdir();
  await fs.mkdir(parentDir, { recursive: true });

  const shortId = randomUUID().slice(0, 8);
  const branch = `support/${opts.slug}-${shortId}`;
  const worktreePath = path.join(
    parentDir,
    `support-worktree-${opts.slug}-${shortId}`,
  );

  await runGit(
    ["worktree", "add", "-b", branch, worktreePath, baseBranch],
    opts.repoPath,
  );

  opts.logger?.info(
    { branch, worktreePath, repoPath: opts.repoPath, baseBranch },
    "worktree: created",
  );

  return { path: worktreePath, branch };
}

/**
 * Removes a worktree and its branch (locally). Idempotent - safe to call
 * even when partial cleanup is needed.
 */
export async function removeWorktree(
  repoPath: string,
  handle: WorktreeHandle,
  logger?: Logger,
): Promise<void> {
  try {
    await runGit(["worktree", "remove", "--force", handle.path], repoPath);
  } catch (err) {
    logger?.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "worktree: remove failed (continuing)",
    );
    // Last-ditch: rm -rf the directory so we don't leave stale files.
    await fs.rm(handle.path, { recursive: true, force: true }).catch(() => {});
  }
  try {
    await runGit(["branch", "-D", handle.branch], repoPath);
  } catch {
    // Branch might already be deleted (or never created remotely); ignore.
  }
}

interface RunResult {
  stdout: string;
  stderr: string;
}

export function runGit(
  args: string[],
  cwd: string,
  opts: { timeoutMs?: number; env?: NodeJS.ProcessEnv } = {},
): Promise<RunResult> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd, env: opts.env ?? process.env });
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error(`git ${args[0]} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (c: Buffer) => stdoutChunks.push(c.toString()));
    child.stderr.on("data", (c: Buffer) => stderrChunks.push(c.toString()));

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`git failed to spawn: ${err.message}`));
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const stdout = stdoutChunks.join("");
      const stderr = stderrChunks.join("");
      if (code !== 0) {
        reject(
          new Error(
            `git ${args[0]} exit ${code} (in ${cwd}): ${stderr.trim().slice(0, 240)}`,
          ),
        );
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}
