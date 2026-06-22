"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { generateFollowUpOutreachEmailAction } from "@/actions/outreach";
import { Button } from "@/components/ui/button";
import type { OutreachQualityReview } from "@/lib/services/outreach-email-generate";

export function GenerateFollowUpEmailButton({
  leadId,
  redirectOnSuccess = false,
  size = "sm",
  variant = "default",
  className,
  onGenerated,
}: {
  leadId: number;
  redirectOnSuccess?: boolean;
  size?: "sm" | "default";
  variant?: "default" | "secondary" | "outline" | "ghost";
  className?: string;
  onGenerated?: (result: {
    subject: string;
    body: string;
    quality: OutreachQualityReview | null;
  }) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await generateFollowUpOutreachEmailAction(leadId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.subject && result.body) {
        onGenerated?.({
          subject: result.subject,
          body: result.body,
          quality: result.quality ?? null,
        });
      }
      if (redirectOnSuccess) {
        router.push(`/leads/${leadId}`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className={className}>
      <Button
        type="button"
        size={size}
        variant={variant}
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending ? "Generating…" : "Generate follow-up email"}
      </Button>
      {error && (
        <span className="mt-1 block text-xs text-red-400">{error}</span>
      )}
    </span>
  );
}
