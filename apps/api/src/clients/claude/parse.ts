export interface ParseResult<T> {
  ok: boolean;
  data?: T;
  reason?: string;
  rawJson?: string;
}

/**
 * Extracts the LAST ```json …``` fenced block from Claude's stdout and JSON-
 * parses it. Using the last match tolerates Claude emitting intermediate
 * reasoning JSON before the final result block.
 */
export function extractLastJsonBlock<T>(rawOutput: string): ParseResult<T> {
  const matches = [...rawOutput.matchAll(/```json\s*([\s\S]*?)```/g)];
  if (matches.length === 0) {
    return { ok: false, reason: "no ```json block found in CLI output" };
  }
  const lastMatch = matches[matches.length - 1];
  if (!lastMatch?.[1]) {
    return { ok: false, reason: "empty ```json block" };
  }
  const rawJson = lastMatch[1].trim();
  try {
    const parsed = JSON.parse(rawJson) as T;
    return { ok: true, data: parsed };
  } catch (err) {
    return {
      ok: false,
      reason: `JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
      rawJson,
    };
  }
}
