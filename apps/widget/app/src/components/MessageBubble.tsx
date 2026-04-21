import type { ChatMessage } from "@ai-support/shared";

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  return (
    <div
      data-role={message.role}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-sm ${
          isUser
            ? "bg-slate-900 text-white"
            : "bg-white text-slate-900 ring-1 ring-slate-200"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
