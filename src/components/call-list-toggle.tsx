"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setCallList } from "@/actions/leads";
import { Button } from "@/components/ui/button";
import type { Lead } from "@/lib/db/schema";

export function CallListToggle({
  lead,
  size = "sm",
}: {
  lead: Lead;
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await setCallList(lead.id, !lead.onCallList);
      router.refresh();
    });
  }

  return (
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
  );
}
