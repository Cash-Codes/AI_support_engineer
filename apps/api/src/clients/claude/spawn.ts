import { spawn } from "node:child_process";
import type { Logger } from "../../logger.js";

export interface SpawnClaudeOptions {
  prompt: string;
  cwd: string;
  allowedTools: string[];
  maxTurns: number;
  timeoutMs: number;
  logger?: Logger;
  /** Short tag included in log lines — e.g. "router", "investigate". */
  tag: string;
}

export interface SpawnClaudeResult {
  stdout: string;
  stderr: string;
}

/**
 * Spawns the Claude Code CLI as a subprocess, pipes the prompt in on stdin,
 * and returns the full stdout/stderr capture. Tools are restricted via
 * --allowedTools; an empty list means no tool use (pure reasoning).
 *
 * Throws on non-zero exit or timeout — callers should catch and surface as
 * a failed phase rather than crashing the request.
 */
export async function spawnClaude(
  opts: SpawnClaudeOptions,
): Promise<SpawnClaudeResult> {
  const { prompt, cwd, allowedTools, maxTurns, timeoutMs, logger, tag } = opts;

  const args = ["--print", "--max-turns", String(maxTurns)];
  if (allowedTools.length > 0) {
    args.push("--allowedTools", allowedTools.join(","));
  }

  logger?.info(
    { tag, cwd, maxTurns, allowedTools: allowedTools.length, timeoutMs },
    "claude-cli: spawning",
  );

  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, { cwd, env: process.env });

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      logger?.warn({ tag, timeoutMs }, "claude-cli: timed out — killed");
      reject(
        new Error(`claude CLI timed out after ${timeoutMs}ms (tag=${tag})`),
      );
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk.toString());
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk.toString());
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        new Error(`claude CLI failed to spawn (tag=${tag}): ${err.message}`),
      );
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
            `claude CLI exited with code ${code} (tag=${tag}): ${stderr.slice(0, 300)}`,
          ),
        );
        return;
      }
      logger?.info(
        { tag, stdoutBytes: stdout.length },
        "claude-cli: completed",
      );
      resolve({ stdout, stderr });
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}
