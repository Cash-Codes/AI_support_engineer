import { describe, expect, it } from "vitest";
import { type IndexedChunk, cosineSimilarity, topK } from "./search.js";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 10);
  });

  it("returns 0 when either vector is zero", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it("throws on length mismatch", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(/mismatch/);
  });
});

describe("topK", () => {
  const chunks: IndexedChunk[] = [
    { docTitle: "a.md", heading: "Intro", text: "Intro text", vector: [1, 0] },
    { docTitle: "a.md", heading: "Body", text: "Body text", vector: [0, 1] },
    {
      docTitle: "b.md",
      heading: "Rel",
      text: "Related thing",
      vector: [0.8, 0.6],
    },
  ];

  it("returns k items sorted by score descending", () => {
    const result = topK([1, 0], chunks, 2);
    expect(result).toHaveLength(2);
    expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
    expect(result[0].title).toBe("a.md · Intro");
  });

  it("caps at the total number of chunks when k exceeds it", () => {
    const result = topK([1, 0], chunks, 99);
    expect(result).toHaveLength(3);
  });

  it("prefixes the title with the doc name and excerpts the text", () => {
    const result = topK([1, 0], chunks, 1);
    expect(result[0].title).toMatch(/^a\.md · /);
    expect(result[0].excerpt.length).toBeLessThanOrEqual(240);
  });
});
