"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteLeadAction } from "@/actions/leads";
import { Button } from "@/components/ui/button";

export function DeleteLeadButton({
  leadId,
  businessName,
}: {
  leadId: number;
  businessName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        `Permanently delete "${businessName}"? This cannot be undone.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("leadId", String(leadId));
      await deleteLeadAction(formData);
      router.refresh();
    });
  }

  return (
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
  );
}
