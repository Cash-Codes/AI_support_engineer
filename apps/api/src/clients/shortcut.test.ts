import { describe, expect, it, vi } from "vitest";
import { createLiveShortcutClient } from "./shortcut.js";

const draft = {
  title: "Support: basket empty",
  body: "## Reported issue\nfoo",
  storyType: "bug" as const,
  labels: ["support-agent", "confidence-high"],
};

function mockFetchOk(
  status = 201,
  body: unknown = { id: 42, app_url: "https://app.shortcut.com/x/story/42" },
) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
}

describe("createLiveShortcutClient", () => {
  it("POSTs to /stories with the draft and the Shortcut-Token header", async () => {
    const fetchImpl = mockFetchOk();
    const client = createLiveShortcutClient({
      apiToken: "tok_test",
      fetchImpl,
    });
    const ticket = await client.createStory(draft);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = fetchImpl.mock.calls[0];
    const url = call[0] as string;
    const init = call[1] as RequestInit;
    expect(url).toContain("/stories");
    expect((init.headers as Record<string, string>)["Shortcut-Token"]).toBe(
      "tok_test",
    );
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      name: draft.title,
      description: draft.body,
      story_type: "bug",
      labels: [{ name: "support-agent" }, { name: "confidence-high" }],
    });
    expect(ticket).toEqual({
      ticketId: "42",
      ticketUrl: "https://app.shortcut.com/x/story/42",
      provider: "shortcut",
    });
  });

  it("includes workflow_state_id when configured", async () => {
    const fetchImpl = mockFetchOk();
    const client = createLiveShortcutClient({
      apiToken: "tok",
      workflowStateId: 123,
      fetchImpl,
    });
    await client.createStory(draft);
    const body = JSON.parse(fetchImpl.mock.calls[0][1]?.body as string);
    expect(body.workflow_state_id).toBe(123);
  });

  it("throws a readable error on non-2xx", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: "unauthorized" }), {
          status: 401,
        }),
    );
    const client = createLiveShortcutClient({ apiToken: "tok", fetchImpl });
    await expect(client.createStory(draft)).rejects.toThrow(/shortcut 401/);
  });

  it("throws when response is missing id/app_url", async () => {
    const fetchImpl = mockFetchOk(201, { id: null, app_url: null });
    const client = createLiveShortcutClient({ apiToken: "tok", fetchImpl });
    await expect(client.createStory(draft)).rejects.toThrow(
      /missing id or app_url/,
    );
  });
});
