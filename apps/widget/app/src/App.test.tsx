import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App.js";

describe("App (placeholder)", () => {
  it("renders the widget placeholder heading", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: /ai support/i }),
    ).toBeInTheDocument();
  });
});
