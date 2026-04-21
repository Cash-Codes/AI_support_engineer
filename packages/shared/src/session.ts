import type { ChatMessage } from "./chat.js";
import type { Confidence, PipelineTrace } from "./pipeline.js";
import type { PRSummary, TicketSummary } from "./ticket.js";

export interface SessionSummary {
  sessionId: string;
  product: string;
  createdAt: string;
  lastActivityAt: string;
  messageCount: number;
  latestConfidence?: Confidence;
  hasTicket: boolean;
  hasPR: boolean;
}

export interface SessionDetail {
  summary: SessionSummary;
  messages: ChatMessage[];
  traces: PipelineTrace[];
  tickets: TicketSummary[];
  prs: PRSummary[];
}

export interface SessionInitRequest {
  product: string;
}

export interface SessionInitResponse {
  sessionId: string;
}
