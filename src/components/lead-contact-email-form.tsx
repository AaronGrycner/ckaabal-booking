"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateLeadContactEmail } from "@/actions/leads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Lead } from "@/lib/db/schema";
import type { EmailConfidence } from "@/lib/services/contact-extract";

function confidenceBadgeVariant(
  confidence: EmailConfidence | null | undefined,
): "success" | "warning" | "secondary" {
  switch (confidence) {
    case "high":
      return "success";
    case "medium":
      return "warning";
    default:
      return "secondary";
  }
}

export function LeadContactEmailForm({
  lead,
  compact = false,
}: {
  lead: Lead;
  compact?: boolean;
}) {
  const router = useRouter();
  const savedEmail = lead.contactEmail ?? "";
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const email = emailDraft ?? savedEmail;
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const trimmedSavedEmail = savedEmail.trim();
  const hasChanges = email.trim() !== trimmedSavedEmail;

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateLeadContactEmail(lead.id, email);
      if (!result.ok) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setMessage({
        type: "success",
        text: email.trim() ? "Contact email saved." : "Contact email cleared.",
      });
      setEmailDraft(null);
      router.refresh();
    });
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs text-zinc-500">
              Contact email
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmailDraft(event.target.value)}
              placeholder="you@business.com"
              className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleSave}
            disabled={isPending || !hasChanges}
          >
            {isPending ? "Saving…" : "Save email"}
          </Button>
        </div>
        {message && (
          <p
            className={
              message.type === "success" ? "text-xs text-emerald-400" : "text-xs text-red-400"
            }
          >
            {message.text}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className="text-zinc-500">Contact email:</span>
      <div className="mt-1 flex flex-wrap items-end gap-2">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmailDraft(event.target.value)}
          placeholder="Add an email if you found one…"
          className="h-9 min-w-[220px] flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={handleSave}
          disabled={isPending || !hasChanges}
        >
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
      {trimmedSavedEmail && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <a href={`mailto:${trimmedSavedEmail}`}>{trimmedSavedEmail}</a>
          {lead.emailConfidence && (
            <Badge
              variant={confidenceBadgeVariant(
                lead.emailConfidence as EmailConfidence,
              )}
            >
              {lead.emailConfidence}
            </Badge>
          )}
          {lead.emailSource && (
            <span className="text-xs text-zinc-500">
              Source: {lead.emailSource}
            </span>
          )}
        </div>
      )}
      {!trimmedSavedEmail && (
        <p className="text-xs text-zinc-500">
          No email found yet. Add one manually if you locate it elsewhere.
        </p>
      )}
      {message && (
        <p
          className={
            message.type === "success" ? "text-xs text-emerald-400" : "text-xs text-red-400"
          }
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
