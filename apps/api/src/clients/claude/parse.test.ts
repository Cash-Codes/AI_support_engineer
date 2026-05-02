import { describe, expect, it } from "vitest";
import { extractLastJsonBlock } from "./parse.js";

describe("extractLastJsonBlock", () => {
  it("parses a single ```json block", () => {
    const out = 'prose\n```json\n{"a":1,"b":"x"}\n```\nafter';
    const r = extractLastJsonBlock<{ a: number; b: string }>(out);
    expect(r.ok).toBe(true);
    expect(r.data).toEqual({ a: 1, b: "x" });
  });

  it("returns the LAST block when Claude emits intermediate JSON", () => {
    const out = [
      "thinking about it",
      "```json",
      '{"intermediate":true}',
      "```",
      "and final answer:",
      "```json",
      '{"final":true}',
      "```",
    ].join("\n");
    const r = extractLastJsonBlock<{ final: boolean }>(out);
    expect(r.ok).toBe(true);
    expect(r.data).toEqual({ final: true });
  });

  it("returns ok=false when no block is found", () => {
    const r = extractLastJsonBlock("no code block here");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/no ```json block/);
  });

  it("returns ok=false with rawJson when parse fails", () => {
    const r = extractLastJsonBlock(
      "prefix\n```json\n{ broken json }\n```\nsuffix",
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/JSON parse error/);
    expect(r.rawJson).toContain("broken");
  });
});
