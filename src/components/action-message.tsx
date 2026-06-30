import type { ActionMessage as ActionMessageType } from "@/lib/action-result";

export function ActionMessage({
  message,
  className = "",
}: {
  message: ActionMessageType | null;
  className?: string;
}) {
  if (!message) return null;

  return (
    <p
      className={
        message.type === "success"
          ? `text-sm text-emerald-400 ${className}`.trim()
          : `text-sm text-red-400 ${className}`.trim()
      }
    >
      {message.text}
    </p>
  );
}
