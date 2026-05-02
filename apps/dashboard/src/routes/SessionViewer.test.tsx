import type { SessionDetail } from "@ai-support/shared";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionViewer } from "./SessionViewer.js";

const detail: SessionDetail = {
  summary: {
    sessionId: "abc-123",
    product: "acme",
    createdAt: "2026-04-22T10:00:00Z",
    lastActivityAt: "2026-04-22T10:05:00Z",
    messageCount: 2,
    latestConfidence: "high",
    hasTicket: true,
    hasPR: false,
  },
  messages: [
    {
      id: "m1",
      role: "user",
      content: "refund missing",
      createdAt: "2026-04-22T10:00:01Z",
    },
    {
      id: "m2",
      role: "assistant",
      content: "Looking into it.",
      createdAt: "2026-04-22T10:00:05Z",
    },
  ],
  traces: [
    {
      events: [
        { phase: "intake", status: "completed", durationMs: 3 },
        { phase: "docsRetrieval", status: "completed", durationMs: 12 },
      ],
      retrievedDocs: [
        { title: "billing.md", score: 0.42, excerpt: "refund processing" },
      ],
      confidence: "high",
    },
  ],
  tickets: [
    {
      ticketId: "T-1",
      ticketUrl: "https://example.test/t/1",
      provider: "mock",
    },
  ],
  prs: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/sessions/:id" element={<SessionViewer />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SessionViewer", () => {
  it("renders the session messages, timeline, retrieved docs and ticket", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(detail), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    renderAt("/sessions/abc-123");

    await waitFor(() => {
      expect(screen.getByText("refund missing")).toBeInTheDocument();
      expect(screen.getByText("Looking into it.")).toBeInTheDocument();
    });
    expect(screen.getByText("intake")).toBeInTheDocument();
    expect(screen.getByText("billing.md")).toBeInTheDocument();
    expect(screen.getByText("T-1")).toBeInTheDocument();
  });

  it("surfaces the fetch error", async () => {
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
