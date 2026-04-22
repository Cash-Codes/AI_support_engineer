import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App (widget)", () => {
  it("renders the ChatWindow shell and mounts the close button", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ sessionId: "s-1" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    render(<App />);
    expect(
      screen.getByRole("heading", { name: /ai support/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /close chat/i }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/Describe your issue/i)).toBeInTheDocument(),
    );
  });
});
