import type { SessionSummary } from "@ai-support/shared";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionsList } from "./SessionsList.js";

const summary = (overrides: Partial<SessionSummary> = {}): SessionSummary => ({
  sessionId: "abcdef1234",
  product: "acme",
  createdAt: "2026-04-22T10:00:00Z",
  lastActivityAt: "2026-04-22T10:05:00Z",
  messageCount: 2,
  latestConfidence: "high",
  hasTicket: true,
  hasPR: false,
  ...overrides,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SessionsList", () => {
  it("renders the empty state when no sessions", async () => {
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

    render(
      <MemoryRouter>
        <SessionsList />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByText(/no sessions yet/i)).toBeInTheDocument(),
    );
  });

  it("renders rows for each returned session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              summary({ sessionId: "11111111abcd", product: "alpha" }),
              summary({ sessionId: "22222222abcd", product: "beta" }),
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );

    render(
      <MemoryRouter>
        <SessionsList />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("alpha")).toBeInTheDocument();
      expect(screen.getByText("beta")).toBeInTheDocument();
    });
    expect(screen.getAllByText(/ticket/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows the error when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );

    render(
      <MemoryRouter>
        <SessionsList />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByText(/failed: 500/)).toBeInTheDocument(),
    );
  });
});
