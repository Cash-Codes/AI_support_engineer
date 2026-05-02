import fs from "node:fs/promises";
import path from "node:path";
import type { RetrievedDoc } from "@ai-support/shared";
import type { Logger } from "../logger.js";
import { type DocChunk, chunkMarkdown } from "./chunker.js";
import type { Embedder } from "./embeddings.js";
import { type IndexedChunk, topK } from "./search.js";

interface CachePayload {
  version: 1;
  modelId: string;
  dim: number;
  fingerprint: string;
  chunks: IndexedChunk[];
}

export interface Retriever {
  search(query: string, k?: number): Promise<RetrievedDoc[]>;
  size(): number;
}

export interface BuildRetrieverOptions {
  docsDir: string;
  cachePath: string;
  embedder: Embedder;
  logger?: Logger;
}

/**
 * Builds (or loads from cache) an in-memory retriever over the markdown
 * files in `docsDir`. The cache is invalidated by a fingerprint composed
 * of file names, sizes and mtimes, plus the embedding model id + dim.
 */
export async function buildRetriever(
  opts: BuildRetrieverOptions,
): Promise<Retriever> {
  const { docsDir, cachePath, embedder, logger } = opts;

  const fileEntries = await listDocs(docsDir);
  if (fileEntries.length === 0) {
    logger?.warn({ docsDir }, "rag: no markdown docs found - empty index");
    return emptyRetriever();
  }

  const fingerprint = await buildFingerprint(fileEntries, embedder);
  const cached = await loadCache(cachePath);
  if (
    cached &&
    cached.fingerprint === fingerprint &&
    cached.modelId === embedder.modelId &&
    cached.dim === embedder.dim
  ) {
    logger?.info(
      { count: cached.chunks.length, cachePath },
      "rag: loaded index from cache",
    );
    return asRetriever(cached.chunks, embedder);
  }

  logger?.info(
    { docs: fileEntries.length, dim: embedder.dim },
    "rag: rebuilding index",
  );

  const chunks: DocChunk[] = [];
  for (const entry of fileEntries) {
    const raw = await fs.readFile(entry.abs, "utf8");
    const docChunks = chunkMarkdown(raw, { docTitle: entry.name });
    chunks.push(...docChunks);
  }

  const vectors = await embedder.embedMany(chunks.map((c) => c.text));
  const indexed: IndexedChunk[] = chunks.map((c, i) => ({
    ...c,
    vector: vectors[i],
  }));

  await writeCache(cachePath, {
    version: 1,
    modelId: embedder.modelId,
    dim: embedder.dim,
    fingerprint,
    chunks: indexed,
  });
  logger?.info(
    { count: indexed.length, cachePath },
    "rag: index built and cached",
  );

  return asRetriever(indexed, embedder);
}

function asRetriever(chunks: IndexedChunk[], embedder: Embedder): Retriever {
  return {
    async search(query: string, k = 5): Promise<RetrievedDoc[]> {
      if (chunks.length === 0) return [];
      const queryVector = await embedder.embed(query);
      return topK(queryVector, chunks, k);
    },
    size(): number {
      return chunks.length;
    },
  };
}

function emptyRetriever(): Retriever {
  return {
    async search(): Promise<RetrievedDoc[]> {
      return [];
    },
    size() {
      return 0;
    },
  };
}

interface DocFileEntry {
  abs: string;
  name: string;
  size: number;
  mtimeMs: number;
}

async function listDocs(docsDir: string): Promise<DocFileEntry[]> {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(docsDir);
  } catch {
    return [];
  }
  const out: DocFileEntry[] = [];
  for (const name of entries) {
    if (!name.endsWith(".md")) continue;
    const abs = path.join(docsDir, name);
    const stat = await fs.stat(abs);
    if (!stat.isFile()) continue;
    out.push({ abs, name, size: stat.size, mtimeMs: stat.mtimeMs });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

async function buildFingerprint(
  entries: DocFileEntry[],
  embedder: Embedder,
): Promise<string> {
  const parts = entries.map((e) => `${e.name}:${e.size}:${e.mtimeMs}`);
  parts.push(`model:${embedder.modelId}:${embedder.dim}`);
  return parts.join("|");
}

async function loadCache(cachePath: string): Promise<CachePayload | null> {
  try {
    const raw = await fs.readFile(cachePath, "utf8");
    const parsed = JSON.parse(raw) as CachePayload;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(
  cachePath: string,
  payload: CachePayload,
): Promise<void> {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(payload), "utf8");
}
