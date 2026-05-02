import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("Dashboard App", () => {
  it("renders the sessions list shell on /", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("[]", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    renderAt("/");
    expect(
      screen.getByRole("link", { name: /ai support dashboard/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /sessions/i }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/no sessions yet/i)).toBeInTheDocument(),
    );
  });

  it("renders the session viewer route on /sessions/:id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );
    renderAt("/sessions/abc-123");
    await waitFor(() =>
      expect(screen.getByText(/failed: 500/)).toBeInTheDocument(),
    );
  });
});
