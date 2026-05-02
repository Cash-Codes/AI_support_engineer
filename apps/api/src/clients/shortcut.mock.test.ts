import { describe, expect, it } from "vitest";
import { createMockShortcutClient } from "./shortcut.mock.js";

const draft = {
  title: "Support: x",
  body: "body",
  storyType: "bug" as const,
  labels: ["support-agent"],
};

describe("createMockShortcutClient", () => {
  it("returns a mock-provider ticket with a short id + example URL", async () => {
    const client = createMockShortcutClient();
    const ticket = await client.createStory(draft);
    expect(ticket.provider).toBe("mock");
    expect(ticket.ticketId).toMatch(/^MOCK-[0-9A-F]{8}$/);
    expect(ticket.ticketUrl).toContain(ticket.ticketId);
  });

  it("records every draft in the `created` buffer", async () => {
    const client = createMockShortcutClient();
    await client.createStory(draft);
    await client.createStory({ ...draft, title: "Support: y" });
    expect(client.created).toHaveLength(2);
    expect(client.created[0].title).toBe("Support: x");
    expect(client.created[1].title).toBe("Support: y");
  });

  it("reset() clears the buffer", async () => {
    const client = createMockShortcutClient();
    await client.createStory(draft);
    client.reset();
    expect(client.created).toHaveLength(0);
  });
});
