export interface TicketSummary {
  ticketUrl: string;
  ticketId: string;
  provider: "shortcut" | "mock";
}

export interface PRSummary {
  prUrl: string;
  branch: string;
  provider: "github" | "mock";
}

export type StoryType = "bug" | "chore" | "feature";

/**
 * Platform-agnostic ticket draft. The ticketing phase composes one of
 * these; a ShortcutClient (live or mock) creates the actual story.
 */
export interface TicketDraft {
  title: string;
  body: string;
  storyType: StoryType;
  labels: string[];
}
