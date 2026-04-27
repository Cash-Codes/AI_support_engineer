import { describe, expect, it } from "vitest";
import { createMockGithubClient } from "./github.mock.js";

const draft = {
  title: "fix: foo",
  body: "body",
  branch: "fix/foo",
  baseBranch: "main",
};

describe("createMockGithubClient", () => {
  it("returns a mock-provider PR with a deterministic URL based on branch", async () => {
    const client = createMockGithubClient();
    const pr = await client.createPullRequest(draft, { cwd: "/tmp/repo" });
    expect(pr.provider).toBe("mock");
    expect(pr.branch).toBe("fix/foo");
    expect(pr.prUrl).toBe("https://example.test/pr/fix/foo");
  });

  it("records each draft in `created` and reset() clears", async () => {
    const client = createMockGithubClient();
    await client.createPullRequest(draft, { cwd: "/tmp/repo" });
    await client.createPullRequest(
      { ...draft, branch: "fix/bar" },
      { cwd: "/tmp/repo" },
    );
    expect(client.created.map((d) => d.branch)).toEqual(["fix/foo", "fix/bar"]);
    client.reset();
    expect(client.created).toHaveLength(0);
  });
});
