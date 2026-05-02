import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createWorktree, removeWorktree, runGit } from "./worktree.js";

let tmp: string;
let repoPath: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "wt-test-"));
  repoPath = path.join(tmp, "repo");
  await fs.mkdir(repoPath, { recursive: true });
  // Initialize a real git repo with one commit on main.
  await runGit(["init", "-b", "main"], repoPath);
  await runGit(["config", "user.email", "test@test"], repoPath);
  await runGit(["config", "user.name", "test"], repoPath);
  await fs.writeFile(path.join(repoPath, "README.md"), "# Test\n");
  await runGit(["add", "."], repoPath);
  await runGit(["commit", "-m", "initial"], repoPath);
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("createWorktree + removeWorktree", () => {
  it("creates a worktree at a new branch off main and tears it down", async () => {
    const handle = await createWorktree({
      repoPath,
      slug: "basket-fix",
      parentDir: tmp,
    });

    expect(handle.branch).toMatch(/^support\/basket-fix-/);
    expect(handle.path).toContain("support-worktree-basket-fix-");

    // Worktree directory exists with the README copied from main
    const stat = await fs.stat(handle.path);
    expect(stat.isDirectory()).toBe(true);
    const readme = await fs.readFile(
      path.join(handle.path, "README.md"),
      "utf8",
    );
    expect(readme).toContain("# Test");

    // Branch is recognized by the source repo
    const { stdout: branchList } = await runGit(["branch"], repoPath);
    expect(branchList).toContain(handle.branch);

    await removeWorktree(repoPath, handle);

    // Directory gone
    await expect(fs.stat(handle.path)).rejects.toBeDefined();
    // Branch gone
    const { stdout: branchListAfter } = await runGit(["branch"], repoPath);
    expect(branchListAfter).not.toContain(handle.branch);
  });

  it("removeWorktree is idempotent - safe to call when partially gone", async () => {
    const handle = await createWorktree({
      repoPath,
      slug: "twice",
      parentDir: tmp,
    });
    await removeWorktree(repoPath, handle);
    // second call shouldn't throw even though everything is gone
    await expect(removeWorktree(repoPath, handle)).resolves.not.toThrow();
  });

  it("creates each worktree at a unique branch + path", async () => {
    const a = await createWorktree({
      repoPath,
      slug: "shared",
      parentDir: tmp,
    });
    const b = await createWorktree({
      repoPath,
      slug: "shared",
      parentDir: tmp,
    });
    expect(a.branch).not.toBe(b.branch);
    expect(a.path).not.toBe(b.path);
    await removeWorktree(repoPath, a);
    await removeWorktree(repoPath, b);
  });
});
