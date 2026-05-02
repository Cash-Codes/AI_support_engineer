import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatWindow } from "./ChatWindow.js";

function mockSseResponse(frames: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const f of frames) controller.enqueue(encoder.encode(f));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function sessionInitResponse(sessionId: string): Response {
  return new Response(JSON.stringify({ sessionId }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChatWindow", () => {
  it("sends a message, shows user bubble, timeline and assistant reply", async () => {
    const frames = [
      'event: phase\ndata: {"phase":"intake","status":"completed","durationMs":2}\n\n',
      'event: phase\ndata: {"phase":"docsRetrieval","status":"completed","durationMs":5}\n\n',
      'event: complete\ndata: {"sessionId":"s-1","assistantMessage":{"id":"m1","role":"assistant","content":"Here is the answer.","createdAt":"2026-04-21T12:00:00Z"},"pipeline":{"events":[],"retrievedDocs":[],"confidence":"high"},"ticket":{"ticketId":"MOCK-1","ticketUrl":"https://example.test/t/1","provider":"mock"}}\n\n',
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.endsWith("/session/init")) return sessionInitResponse("s-1");
        if (url.endsWith("/chat")) return mockSseResponse(frames);
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const user = userEvent.setup();
    render(<ChatWindow />);

    const input = await screen.findByPlaceholderText(/Whats the issue/i);
    await waitFor(() => expect(input).toBeEnabled());

    await user.type(input, "refund missing");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("refund missing")).toBeInTheDocument();
    expect(await screen.findByText("Here is the answer.")).toBeInTheDocument();
    expect(await screen.findByText(/Ticket MOCK-1/)).toBeInTheDocument();

    // Confidence pill is visible immediately
    expect(await screen.findByText(/high confidence/i)).toBeInTheDocument();

    // Phase trace is collapsed behind a toggle; expand it
    const toggle = await screen.findByRole("button", { name: /view trace/i });
    await user.click(toggle);
    expect(await screen.findByText("intake")).toBeInTheDocument();
    expect(await screen.findByText("docsRetrieval")).toBeInTheDocument();
  });
});
