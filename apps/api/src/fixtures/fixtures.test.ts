import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadFixtures } from "./index.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fixtures-"));
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function write(name: string, fixture: unknown) {
  await fs.writeFile(path.join(tmp, name), JSON.stringify(fixture), "utf8");
}

describe("loadFixtures", () => {
  it("returns undefined match on unknown query", async () => {
    await write("a.json", {
      slug: "a",
      keywords: ["unrelated"],
      router: { escalate: false, rationale: "x", confidence: "low" },
      resolution: {
        explanation: "x",
        workaround: "x",
        confidence: "low",
        citations: [],
      },
    });
    const lib = await loadFixtures(tmp);
    expect(lib.match("totally different question")).toBeUndefined();
  });

  it("matches case-insensitively on substring keywords", async () => {
    await write("q.json", {
      slug: "q-bug",
      keywords: ["6 EGGS", "Quantity Wrong"],
      router: { escalate: true, rationale: "x", confidence: "medium" },
      resolution: {
        explanation: "x",
        workaround: "x",
        confidence: "medium",
        citations: [],
      },
    });
    const lib = await loadFixtures(tmp);
    expect(lib.match("my 6 eggs came out wrong")?.slug).toBe("q-bug");
    expect(lib.match("why is the quantity wrong again")?.slug).toBe("q-bug");
  });

  it("returns the first-by-slug fixture when multiple match", async () => {
    await write("b-first.json", {
      slug: "b-first",
      keywords: ["overlap"],
      router: { escalate: true, rationale: "x", confidence: "high" },
      resolution: {
        explanation: "x",
        workaround: "x",
        confidence: "high",
        citations: [],
      },
    });
    await write("a-second.json", {
      slug: "a-second",
      keywords: ["overlap"],
      router: { escalate: true, rationale: "x", confidence: "high" },
      resolution: {
        explanation: "x",
        workaround: "x",
        confidence: "high",
        citations: [],
      },
    });
    const lib = await loadFixtures(tmp);
    // sorted by slug asc - "a-second" wins
    expect(lib.match("something overlap here")?.slug).toBe("a-second");
  });

  it("throws on malformed fixture json", async () => {
    await write("bad.json", { keywords: [] }); // missing slug
    await expect(loadFixtures(tmp)).rejects.toThrow(/slug/);
  });

  it("returns an empty library when the dir does not exist", async () => {
    const lib = await loadFixtures(path.join(tmp, "nope"));
    expect(lib.all()).toEqual([]);
    expect(lib.fallback().slug).toBe("no-match");
  });
});
