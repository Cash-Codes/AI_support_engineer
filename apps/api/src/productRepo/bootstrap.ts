import fs from "node:fs/promises";
import path from "node:path";
import type { Logger } from "../logger.js";

export interface ProductRepoResolution {
  /** Absolute path to the product repo root, or undefined if unavailable. */
  path: string | undefined;
  /** Where the path came from — useful for observability. */
  source: "config" | "none";
  /** True if the path exists on disk and looks like a repo (has a git dir OR package.json). */
  exists: boolean;
}

export interface ResolveProductRepoOptions {
  configPath?: string;
  configUrl?: string;
  logger?: Logger;
}

/**
 * Resolves the absolute path to the product repo. In v1 we only support a
 * local path — future iterations will clone from `configUrl` inside the
 * container entrypoint.
 *
 * Returns an undefined path when nothing is configured; callers should
 * treat that as "no code investigation possible" and fall back gracefully.
 */
export async function resolveProductRepo(
  opts: ResolveProductRepoOptions,
): Promise<ProductRepoResolution> {
  const { configPath, logger } = opts;

  if (!configPath) {
    logger?.warn(
      "product repo: PRODUCT_REPO_PATH not set — code investigation will be unavailable",
    );
    return { path: undefined, source: "none", exists: false };
  }

  const absolute = path.resolve(configPath);
  const exists = await looksLikeRepo(absolute);
  if (!exists) {
    logger?.warn(
      { path: absolute },
      "product repo: path does not exist or lacks a git/package.json marker",
    );
  } else {
    logger?.info({ path: absolute }, "product repo: resolved");
  }
  return { path: absolute, source: "config", exists };
}

async function looksLikeRepo(absolute: string): Promise<boolean> {
  try {
    const stat = await fs.stat(absolute);
    if (!stat.isDirectory()) return false;
  } catch {
    return false;
  }
  // A repo for our purposes has at least one of: .git/, package.json,
  // or a top-level docs/ directory (which is what the api cares about).
  for (const marker of [".git", "package.json", "docs"]) {
    try {
      await fs.stat(path.join(absolute, marker));
      return true;
    } catch {
      // try next marker
    }
  }
  return false;
}
