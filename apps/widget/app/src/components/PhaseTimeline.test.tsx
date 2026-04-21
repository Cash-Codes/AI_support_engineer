import type { PhaseEvent } from "@ai-support/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PhaseTimeline } from "./PhaseTimeline.js";

describe("PhaseTimeline", () => {
  it("renders empty state when no events", () => {
    render(<PhaseTimeline events={[]} />);
    expect(screen.getByText(/no phases yet/i)).toBeInTheDocument();
  });

  it("shows one row per phase, collapsing to latest status", () => {
    const events: PhaseEvent[] = [
      { phase: "intake", status: "started" },
      { phase: "intake", status: "completed", durationMs: 4 },
      { phase: "docsRetrieval", status: "started" },
    ];
    render(<PhaseTimeline events={events} />);
    expect(screen.getByText("intake")).toBeInTheDocument();
    expect(screen.getByText("docsRetrieval")).toBeInTheDocument();
    expect(screen.getByText(/completed · 4ms/)).toBeInTheDocument();
    expect(screen.getByText(/^started$/i)).toBeInTheDocument();
  });
});
