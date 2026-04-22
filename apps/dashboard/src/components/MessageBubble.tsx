import type { ChatMessage } from "@ai-support/shared";

interface Props {
  message: ChatMessage;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const label = isUser ? "User" : "Assistant";
  return (
    <article
      data-role={message.role}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-brand text-white"
            : "border border-line bg-surface text-fg-0 shadow-sm"
        }`}
      >
        <div
          className={`mb-1 flex items-center justify-between gap-3 text-[10px] uppercase tracking-wide ${
            isUser ? "text-white/70" : "text-fg-2"
          }`}
        >
          <span className="font-medium">{label}</span>
          <span className="font-mono tabular-nums">
            {fmtTime(message.createdAt)}
          </span>
        </div>
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </article>
  );
}
