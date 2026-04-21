import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useChatStream } from "./useChatStream.js";

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

describe("useChatStream", () => {
  it("initializes a session on mount and reaches idle state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.endsWith("/session/init")) return sessionInitResponse("s-1");
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const { result } = renderHook(() => useChatStream());
    await waitFor(() => expect(result.current.state).toBe("idle"));
    expect(result.current.sessionId).toBe("s-1");
  });

  it("streams phase events and a final complete frame", async () => {
    const frames = [
      'event: phase\ndata: {"phase":"intake","status":"started"}\n\n',
      'event: phase\ndata: {"phase":"intake","status":"completed","durationMs":4}\n\n',
      'event: complete\ndata: {"sessionId":"s-1","assistantMessage":{"id":"m1","role":"assistant","content":"hello back","createdAt":"2026-04-21T12:00:00Z"},"pipeline":{"events":[],"retrievedDocs":[],"confidence":"low"}}\n\n',
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

    const { result } = renderHook(() => useChatStream());
    await waitFor(() => expect(result.current.state).toBe("idle"));

    await act(async () => {
      await result.current.send("hi");
    });

    await waitFor(() => expect(result.current.state).toBe("idle"));
    expect(result.current.phaseEvents).toHaveLength(2);
    expect(result.current.phaseEvents[0].phase).toBe("intake");
    expect(result.current.messages.at(-1)?.content).toBe("hello back");
    expect(result.current.lastResponse?.sessionId).toBe("s-1");
  });

  it("transitions to error if session init fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );
    const { result } = renderHook(() => useChatStream());
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.error).toContain("/session/init");
  });
});
