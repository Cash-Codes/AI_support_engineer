import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveProductRepo } from "./bootstrap.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "productrepo-"));
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("resolveProductRepo", () => {
  it("returns source=none when no path configured", async () => {
    const r = await resolveProductRepo({});
    expect(r.path).toBeUndefined();
    expect(r.source).toBe("none");
    expect(r.exists).toBe(false);
  });

  it("returns exists=false when configured path does not exist", async () => {
    const r = await resolveProductRepo({
      configPath: path.join(tmp, "does-not-exist"),
    });
    expect(r.path).toBeDefined();
    expect(r.exists).toBe(false);
  });

  it("returns exists=true when path has a docs directory", async () => {
    await fs.mkdir(path.join(tmp, "docs"), { recursive: true });
    const r = await resolveProductRepo({ configPath: tmp });
    expect(r.path).toBe(path.resolve(tmp));
    expect(r.exists).toBe(true);
    expect(r.source).toBe("config");
  });

  it("returns exists=true when path has a .git directory", async () => {
    await fs.mkdir(path.join(tmp, ".git"), { recursive: true });
    const r = await resolveProductRepo({ configPath: tmp });
    expect(r.exists).toBe(true);
  });

  it("returns exists=true when path has a package.json", async () => {
    await fs.writeFile(path.join(tmp, "package.json"), "{}");
    const r = await resolveProductRepo({ configPath: tmp });
    expect(r.exists).toBe(true);
  });

  it("returns exists=false when path is a directory but lacks any marker", async () => {
    await fs.mkdir(path.join(tmp, "empty"));
    const r = await resolveProductRepo({
      configPath: path.join(tmp, "empty"),
    });
    expect(r.exists).toBe(false);
  });
});
