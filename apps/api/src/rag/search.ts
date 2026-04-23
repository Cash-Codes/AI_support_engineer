import type { RetrievedDoc } from "@ai-support/shared";

export interface IndexedChunk {
  docTitle: string;
  heading: string;
  text: string;
  vector: number[];
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `cosineSimilarity: vector length mismatch (${a.length} vs ${b.length})`,
    );
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function topK(
  queryVector: number[],
  chunks: IndexedChunk[],
  k: number,
): RetrievedDoc[] {
  const scored = chunks.map((c) => ({
    chunk: c,
    score: cosineSimilarity(queryVector, c.vector),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map(({ chunk, score }) => ({
    title: `${chunk.docTitle} · ${chunk.heading}`,
    score,
    excerpt: chunk.text.slice(0, 240),
  }));
}
