import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Embedder } from "./embeddings.js";
import { buildRetriever } from "./indexer.js";

/**
 * Deterministic in-memory embedder for tests — hashes text into a tiny
 * dense vector. Semantic quality is nonsense, but it's stable enough to
 * verify the indexer wiring + cache behavior.
 */
function makeFakeEmbedder(dim = 8): Embedder & { calls: number } {
  const state = { calls: 0 };
  const embed = (text: string): number[] => {
    state.calls++;
    const vec = new Array(dim).fill(0);
    for (let i = 0; i < text.length; i++) {
      vec[i % dim] += text.charCodeAt(i) / 255;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  };
  return {
    modelId: "fake-hash",
    dim,
    async embed(text: string) {
      return embed(text);
    },
    async embedMany(texts: string[]) {
      return texts.map(embed);
    },
    get calls() {
      return state.calls;
    },
  };
}

let tmpRoot: string;
let docsDir: string;
let cachePath: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "rag-indexer-"));
  docsDir = path.join(tmpRoot, "docs");
  cachePath = path.join(tmpRoot, "data/rag-index.json");
  await fs.mkdir(docsDir, { recursive: true });
  await fs.writeFile(
    path.join(docsDir, "billing.md"),
    "# Billing\n\nHow invoices and refunds work.\n\n## Refunds\n\nRefunds appear in history.\n",
  );
  await fs.writeFile(
    path.join(docsDir, "auth.md"),
    "# Auth\n\nSession timeout is 15 minutes by default.\n",
  );
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("buildRetriever", () => {
  it("indexes all markdown files under docsDir and returns top-K results", async () => {
    const embedder = makeFakeEmbedder();
    const retriever = await buildRetriever({ docsDir, cachePath, embedder });

    // Two docs, one with two headings → 3 chunks expected
    expect(retriever.size()).toBe(3);

    const docs = await retriever.search("refunds in billing history", 2);
    expect(docs).toHaveLength(2);
    // titles are `<docTitle> · <heading>`
    for (const d of docs) expect(d.title).toMatch(/·/);
  });

  it("writes a cache file that is reusable on a second build", async () => {
    const embedder1 = makeFakeEmbedder();
    await buildRetriever({ docsDir, cachePath, embedder: embedder1 });
    const firstCalls = embedder1.calls;
    expect(firstCalls).toBeGreaterThan(0);

    // second build with a fresh embedder should hit the cache and
    // skip the embedMany call during build
    const embedder2 = makeFakeEmbedder();
    const retriever2 = await buildRetriever({
      docsDir,
      cachePath,
      embedder: embedder2,
    });
    expect(embedder2.calls).toBe(0); // cache hit → no build-time embeds
    expect(retriever2.size()).toBe(3); // same 3 chunks recovered from cache

    // query path should still work — this exercises embed()
    const docs = await retriever2.search("refund", 1);
    expect(docs).toHaveLength(1);
    expect(embedder2.calls).toBe(1);
  });

  it("invalidates the cache when docs change", async () => {
    const embedder1 = makeFakeEmbedder();
    await buildRetriever({ docsDir, cachePath, embedder: embedder1 });
    const countBefore = embedder1.calls;

    // mutate a doc so its mtime + size differ
    await new Promise((r) => setTimeout(r, 15));
    await fs.writeFile(
      path.join(docsDir, "billing.md"),
      "# Billing\n\nCompletely new billing content about refunds.\n",
    );

    const embedder2 = makeFakeEmbedder();
    await buildRetriever({ docsDir, cachePath, embedder: embedder2 });
    // Rebuild occurred → embedMany ran → calls > 0
    expect(embedder2.calls).toBeGreaterThan(0);
    expect(countBefore).toBeGreaterThan(0);
  });

  it("returns an empty retriever when docsDir is empty", async () => {
    await fs.rm(docsDir, { recursive: true, force: true });
    await fs.mkdir(docsDir);
    const embedder = makeFakeEmbedder();
    const retriever = await buildRetriever({ docsDir, cachePath, embedder });
    expect(retriever.size()).toBe(0);
    expect(await retriever.search("anything")).toEqual([]);
  });
});
