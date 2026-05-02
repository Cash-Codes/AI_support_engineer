import { describe, expect, it } from "vitest";
import { runIntake } from "./intake.js";

describe("runIntake", () => {
  it("normalizes whitespace and preserves the original", () => {
    const result = runIntake(
      { message: "  refund   missing  " },
      { sessionId: "s1" },
    );
    expect(result.normalized).toBe("refund missing");
    expect(result.originalMessage).toBe("  refund   missing  ");
    expect(result.sessionId).toBe("s1");
  });

  it("generates a UUID sessionId when none is provided", () => {
    const result = runIntake({ message: "hi" }, {});
    expect(result.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("rejects empty or whitespace-only messages", () => {
    expect(() => runIntake({ message: "   " }, {})).toThrow(/empty/i);
    expect(() => runIntake({ message: "" }, {})).toThrow(/empty/i);
  });
});
