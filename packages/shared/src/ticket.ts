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
