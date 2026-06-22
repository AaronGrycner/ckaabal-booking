"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Lead, LeadActivity, WebsiteAudit } from "@/lib/db/schema";
import { formatLeadSummary } from "@/lib/lead-summary";
import { copyTextToClipboard, copyTextToClipboardSync } from "@/lib/utils";

export function CopyLeadSummaryButton({
  lead,
  audit,
  activities,
  size = "sm",
  variant = "secondary",
  label = "Copy summary",
}: {
  lead: Lead;
  audit?: WebsiteAudit | null;
  activities?: LeadActivity[];
  size?: "sm" | "default" | "lg";
  variant?: "default" | "secondary" | "outline" | "ghost";
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  function copySummary() {
    try {
      const text = formatLeadSummary(lead, audit, activities);
      if (!text.trim()) {
        throw new Error("Summary is empty");
      }

      if (copyTextToClipboardSync(text)) {
        setState("copied");
        setTimeout(() => setState("idle"), 2000);
        return;
      }

      void copyTextToClipboard(text)
        .then(() => {
          setState("copied");
          setTimeout(() => setState("idle"), 2000);
        })
        .catch((error) => {
          console.error("Copy summary failed:", error);
          setState("error");
          setTimeout(() => setState("idle"), 2500);
        });
    } catch (error) {
      console.error("Copy summary failed:", error);
      setState("error");
      setTimeout(() => setState("idle"), 2500);
    }
  }

  const buttonLabel =
    state === "copied"
      ? "Copied!"
      : state === "error"
        ? "Copy failed"
        : label;

  return (
    <Button type="button" variant={variant} size={size} onClick={copySummary}>
      {buttonLabel}
    </Button>
  );
}
