export type PhaseName =
  | "intake"
  | "docsRetrieval"
  | "router"
  | "codeInvestigation"
  | "resolution"
  | "ticketing"
  | "openFixPR";

export type PhaseStatus = "started" | "completed" | "skipped" | "failed";

export interface PhaseEvent {
  phase: PhaseName;
  status: PhaseStatus;
  durationMs?: number;
  summary?: string;
  payload?: unknown;
}

export interface RetrievedDoc {
  title: string;
  score: number;
  excerpt: string;
}

export type Confidence = "low" | "medium" | "high";

export interface PipelineTrace {
  events: PhaseEvent[];
  retrievedDocs: RetrievedDoc[];
  rootCause?: string;
  affectedFiles?: string[];
  confidence: Confidence;
}

export interface RouterDecision {
  escalate: boolean;
  rationale: string;
  confidence: Confidence;
  draftAnswer?: string;
}
