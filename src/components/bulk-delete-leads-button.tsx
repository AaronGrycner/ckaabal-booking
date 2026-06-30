"use client";

import { deleteLeadsAction } from "@/actions/leads";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { useActionRunner } from "@/hooks/use-action-runner";

export function BulkDeleteLeadsButton({
  leadIds,
  disabled,
  onDeleted,
}: {
  leadIds: number[];
  disabled?: boolean;
  onDeleted?: () => void;
}) {
  const { isPending, message, run } = useActionRunner();

  function handleClick() {
    if (!leadIds.length) return;

    if (
      !confirm(
        `Permanently delete ${leadIds.length} lead${leadIds.length === 1 ? "" : "s"}? This cannot be undone.`,
      )
    ) {
      return;
    }

    run(
      async () => {
        const formData = new FormData();
        formData.set("leadIds", leadIds.join(","));
        return deleteLeadsAction(formData);
      },
      {
        successMessage: `Deleted ${leadIds.length} lead${leadIds.length === 1 ? "" : "s"}.`,
        onSuccess: onDeleted,
      },
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={disabled || isPending || !leadIds.length}
        className="border-red-900/60 text-red-300 hover:bg-red-950/40 hover:text-red-200"
      >
        {isPending ? "Deleting…" : `Delete selected (${leadIds.length})`}
      </Button>
      <ActionMessage message={message} className="text-xs" />
    </div>
  );
}
