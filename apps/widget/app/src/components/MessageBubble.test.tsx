import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageBubble } from "./MessageBubble.js";

describe("MessageBubble", () => {
  it("renders user messages with data-role=user", () => {
    render(
      <MessageBubble
        message={{
          id: "1",
          role: "user",
          content: "refund is missing",
          createdAt: "2026-04-21T12:00:00Z",
        }}
      />,
    );
    const bubble = screen.getByText("refund is missing");
    expect(bubble).toBeInTheDocument();
    expect(bubble.closest("[data-role]")?.getAttribute("data-role")).toBe(
      "user",
    );
  });

  it("renders assistant messages with data-role=assistant", () => {
    render(
      <MessageBubble
        message={{
          id: "2",
          role: "assistant",
          content: "Looking into it.",
          createdAt: "2026-04-21T12:00:01Z",
        }}
      />,
    );
    const bubble = screen.getByText("Looking into it.");
    expect(bubble.closest("[data-role]")?.getAttribute("data-role")).toBe(
      "assistant",
    );
  });
});
