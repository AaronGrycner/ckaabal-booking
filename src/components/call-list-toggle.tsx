"use client";

import { setCallList } from "@/actions/leads";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import type { Lead } from "@/lib/db/schema";
import { useActionRunner } from "@/hooks/use-action-runner";

export function CallListToggle({
  lead,
  size = "sm",
}: {
  lead: Lead;
  size?: "sm" | "default";
}) {
  const { isPending, message, run } = useActionRunner();

  function toggle() {
    run(() => setCallList(lead.id, !lead.onCallList));
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        size={size}
        variant={lead.onCallList ? "default" : "outline"}
        onClick={toggle}
        disabled={isPending}
      >
        {isPending
          ? "Saving…"
          : lead.onCallList
            ? "On call list"
            : "Add to call list"}
      </Button>
      <ActionMessage message={message} className="text-xs" />
    </div>
  );
}
