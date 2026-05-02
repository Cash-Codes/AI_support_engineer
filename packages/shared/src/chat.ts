import type { PipelineTrace } from "./pipeline.js";
import type { PRSummary, TicketSummary } from "./ticket.js";

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ChatRequest {
  sessionId: string;
  message: string;
}

export interface ChatResponse {
  sessionId: string;
  assistantMessage: ChatMessage;
  pipeline: PipelineTrace;
  ticket?: TicketSummary;
  pr?: PRSummary;
}
