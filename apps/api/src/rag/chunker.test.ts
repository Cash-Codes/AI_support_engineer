import { describe, expect, it } from "vitest";
import { chunkMarkdown } from "./chunker.js";

describe("chunkMarkdown", () => {
  it("returns one chunk per heading with body text included", () => {
    const source = [
      "# Product",
      "",
      "Intro paragraph about the product.",
      "",
      "## Billing",
      "",
      "Billing specific body text.",
      "",
      "## Sessions",
      "",
      "Sessions body.",
    ].join("\n");

    const chunks = chunkMarkdown(source, { docTitle: "product.md" });
    expect(chunks).toHaveLength(3);
    expect(chunks[0].heading).toBe("Product");
    expect(chunks[0].text).toContain("Intro paragraph");
    expect(chunks[1].heading).toBe("Billing");
    expect(chunks[2].heading).toBe("Sessions");
    for (const c of chunks) expect(c.docTitle).toBe("product.md");
  });

  it("drops headings that have no body text", () => {
    const source = "# Empty\n\n## Real\n\nbody here.\n";
    const chunks = chunkMarkdown(source, { docTitle: "e.md" });
    expect(chunks.map((c) => c.heading)).toEqual(["Real"]);
  });

  it("splits a single oversized heading by paragraph boundaries", () => {
    const paragraph = "Some sentence. ".repeat(40); // ~600 chars
    const body = [paragraph, paragraph, paragraph].join("\n\n"); // ~1800 chars
    const source = `# Big\n\n${body}`;
    const chunks = chunkMarkdown(source, {
      docTitle: "big.md",
      softCharLimit: 800,
    });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.heading).toBe("Big");
      expect(c.docTitle).toBe("big.md");
    }
  });

  it("produces identical chunks for identical input (deterministic)", () => {
    const source = "# A\nbody a\n\n## B\nbody b\n";
    const first = chunkMarkdown(source, { docTitle: "x" });
    const second = chunkMarkdown(source, { docTitle: "x" });
    expect(first).toEqual(second);
  });
});
