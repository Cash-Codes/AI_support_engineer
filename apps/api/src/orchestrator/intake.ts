import { randomUUID } from "node:crypto";

export interface IntakeInput {
  message: string;
}

export interface IntakeContext {
  sessionId?: string;
}

export interface IntakeResult {
  sessionId: string;
  normalized: string;
  originalMessage: string;
}

export function runIntake(
  input: IntakeInput,
  ctx: IntakeContext,
): IntakeResult {
  const normalized = input.message.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) throw new Error("intake: empty message");
  return {
    sessionId: ctx.sessionId ?? randomUUID(),
    normalized,
    originalMessage: input.message,
  };
}
