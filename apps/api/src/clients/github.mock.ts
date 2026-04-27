import type { PRDraft, PRSummary } from "@ai-support/shared";
import type { GithubClient } from "./github.js";

export interface MockGithubClient extends GithubClient {
  created: PRDraft[];
  reset(): void;
}

export function createMockGithubClient(): MockGithubClient {
  const created: PRDraft[] = [];
  return {
    mode: "mock",
    created,
    reset() {
      created.length = 0;
    },
    async createPullRequest(draft): Promise<PRSummary> {
      created.push(draft);
      return {
        prUrl: `https://example.test/pr/${draft.branch}`,
        branch: draft.branch,
        provider: "mock",
      };
    },
  };
}
