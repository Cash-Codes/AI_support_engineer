import type { ChatMessage, ChatResponse, PhaseEvent } from "@ai-support/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CHAT_ENDPOINT,
  buildChatInit,
  initSession,
  readProductFromUrl,
} from "../lib/api.js";

export type StreamState = "idle" | "initializing" | "streaming" | "error";

export interface UseChatStream {
  messages: ChatMessage[];
  phaseEvents: PhaseEvent[];
  lastResponse: ChatResponse | null;
  sessionId: string | null;
  state: StreamState;
  error: string | null;
  send: (content: string) => Promise<void>;
}

export function useChatStream(): UseChatStream {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phaseEvents, setPhaseEvents] = useState<PhaseEvent[]>([]);
  const [lastResponse, setLastResponse] = useState<ChatResponse | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<StreamState>("initializing");
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    initSession(readProductFromUrl())
      .then((id) => {
        if (cancelled) return;
        sessionIdRef.current = id;
        setSessionId(id);
        setState("idle");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const send = useCallback(async (content: string) => {
    const activeSessionId = sessionIdRef.current;
    if (!activeSessionId) {
      setError("session not initialized");
      setState("error");
      return;
    }

    setState("streaming");
    setError(null);
    setPhaseEvents([]);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch(
        CHAT_ENDPOINT,
        buildChatInit({ sessionId: activeSessionId, message: content }),
      );
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        while (true) {
          const idx = buf.indexOf("\n\n");
          if (idx === -1) break;
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          handleFrame(frame);
        }
      }
      setState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }

    function handleFrame(frame: string) {
      const lines = frame.split("\n");
      let event = "message";
      const dataLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      const data = dataLines.join("\n");
      if (!data) return;

      if (event === "phase") {
        const pe = JSON.parse(data) as PhaseEvent;
        setPhaseEvents((prev) => [...prev, pe]);
      } else if (event === "complete") {
        const cr = JSON.parse(data) as ChatResponse;
        sessionIdRef.current = cr.sessionId;
        setSessionId(cr.sessionId);
        setLastResponse(cr);
        setMessages((prev) => [...prev, cr.assistantMessage]);
      }
    }
  }, []);

  return { messages, phaseEvents, lastResponse, sessionId, state, error, send };
}
