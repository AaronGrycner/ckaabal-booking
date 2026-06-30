"use client";

import { deleteLeadAction } from "@/actions/leads";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { useActionRunner } from "@/hooks/use-action-runner";

export function DeleteLeadButton({
  leadId,
  businessName,
}: {
  leadId: number;
  businessName: string;
}) {
  const { isPending, message, run } = useActionRunner();

  function handleClick() {
    if (
      !confirm(
        `Permanently delete "${businessName}"? This cannot be undone.`,
      )
    ) {
      return;
    }

    run(async () => {
      const formData = new FormData();
      formData.set("leadId", String(leadId));
      return deleteLeadAction(formData);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
        className="text-red-400 hover:text-red-300"
      >
        {isPending ? "Deleting…" : "Delete"}
      </Button>
      <ActionMessage message={message} className="text-xs" />
    </div>
  );
}
