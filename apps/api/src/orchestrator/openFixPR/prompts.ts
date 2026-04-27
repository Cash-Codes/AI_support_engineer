import type { CodeInvestigationResult } from "../codeInvestigation.js";
import type { IntakeResult } from "../intake.js";
import type { ResolutionResult } from "../resolution.js";

export function buildFixPrompt(args: {
  intake: IntakeResult;
  investigation: CodeInvestigationResult;
  resolution: ResolutionResult;
  branch: string;
}): string {
  const filesList = args.investigation.affectedFiles.length
    ? args.investigation.affectedFiles.map((f) => `  - ${f}`).join("\n")
    : "  (none specified — locate them yourself)";

  return `You are the implementation stage of an AI support agent. The
investigation phase has already located the probable root cause; your
job is to make the actual code change, commit it, and push the branch.

# User-reported issue
${args.intake.originalMessage}

# Probable root cause (from investigation)
${args.investigation.rootCause}

# Affected files
${filesList}

# Workaround the support reply already shipped
${args.resolution.workaround}

# Working environment
You are inside a fresh git worktree on branch \`${args.branch}\` (already
checked out). Make the smallest correct change that fixes the root cause.
Do not refactor unrelated code, do not add new dependencies.

# Required steps (use the Edit / Write / Read / Grep / Glob tools, then Bash for git)
1. Read the affected files to confirm the diagnosis.
2. Apply the fix. Keep changes minimal and well-scoped.
3. Commit your changes:  \`git add -A && git commit -m "<message>"\`
4. Push the branch:      \`git push --set-upstream origin ${args.branch}\`

If you cannot apply the fix (file gone, ambiguity, etc.), do NOT push.
Set "outcome": "no_changes" or "error" in the result block and explain.

# Output contract
Your response MUST end with a single \`\`\`json fenced block in this shape:

{
  "outcome": "success" | "no_changes" | "error",
  "summary": string,
  "files_changed": string[],   // repo-relative paths
  "commit_message": string
}

Return only the JSON in the final \`\`\`json block.`;
}

export interface FixOutput {
  outcome: "success" | "no_changes" | "error";
  summary: string;
  files_changed: string[];
  commit_message: string;
}

export function normalizeFixOutput(d: Partial<FixOutput>): FixOutput {
  const valid = new Set(["success", "no_changes", "error"]);
  const outcome = (
    typeof d.outcome === "string" && valid.has(d.outcome) ? d.outcome : "error"
  ) as FixOutput["outcome"];
  const files = Array.isArray(d.files_changed)
    ? (d.files_changed as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : [];
  return {
    outcome,
    summary: typeof d.summary === "string" ? d.summary : "",
    files_changed: files,
    commit_message:
      typeof d.commit_message === "string" ? d.commit_message : "",
  };
}
