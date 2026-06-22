"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteLeadsAction } from "@/actions/leads";
import { Button } from "@/components/ui/button";

export function BulkDeleteLeadsButton({
  leadIds,
  disabled,
  onDeleted,
}: {
  leadIds: number[];
  disabled?: boolean;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!leadIds.length) return;

    if (
      !confirm(
        `Permanently delete ${leadIds.length} lead${leadIds.length === 1 ? "" : "s"}? This cannot be undone.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("leadIds", leadIds.join(","));
      await deleteLeadsAction(formData);
      onDeleted?.();
      router.refresh();
    });
  }

  return (
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
  );
}
