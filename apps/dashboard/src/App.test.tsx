import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "./App.js";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("Dashboard App", () => {
  it("renders the sessions list on /", () => {
    renderAt("/");
    expect(
      screen.getByRole("link", { name: /ai support dashboard/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /sessions/i }),
    ).toBeInTheDocument();
  });

  it("renders the session viewer with the id on /sessions/:id", () => {
    renderAt("/sessions/abc-123");
    expect(
      screen.getByRole("heading", { name: /session abc-123/i }),
    ).toBeInTheDocument();
  });
});
