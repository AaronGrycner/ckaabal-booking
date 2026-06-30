"use client";

import { useState } from "react";
import { updateReviewStatus } from "@/actions/leads";
import { ActionMessage } from "@/components/action-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Lead } from "@/lib/db/schema";
import {
  formatCrmDateTime,
  reviewStatusBadgeVariant,
  reviewStatusLabel,
} from "@/lib/crm-utils";
import { useActionRunner } from "@/hooks/use-action-runner";

export function LeadReviewBar({ lead }: { lead: Lead }) {
  const { isPending, message, run } = useActionRunner();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  function handleApprove() {
    run(() => updateReviewStatus(lead.id, "approved_for_outreach"));
  }

  function handleReject() {
    run(async () => {
      const result = await updateReviewStatus(
        lead.id,
        "rejected",
        rejectionReason.trim() || undefined,
      );
      if (result.ok) {
        setShowRejectForm(false);
        setRejectionReason("");
      }
      return result;
    });
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-zinc-300">Review</span>
          <Badge variant={reviewStatusBadgeVariant(lead.reviewStatus)}>
            {reviewStatusLabel(lead.reviewStatus)}
          </Badge>
          {lead.reviewedAt && (
            <span className="text-xs text-zinc-500">
              {formatCrmDateTime(lead.reviewedAt)}
            </span>
          )}
          {lead.rejectionReason && (
            <span className="text-xs text-zinc-500">
              — {lead.rejectionReason}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={
              lead.reviewStatus === "approved_for_outreach" ? "default" : "outline"
            }
            onClick={handleApprove}
            disabled={isPending}
          >
            Approve for outreach
          </Button>
          <Button
            type="button"
            size="sm"
            variant={lead.reviewStatus === "rejected" ? "default" : "outline"}
            onClick={() => setShowRejectForm((v) => !v)}
            disabled={isPending}
          >
            Reject
          </Button>
        </div>
      </div>

      {showRejectForm && (
        <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={2}
            placeholder="Optional rejection reason…"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleReject}
            disabled={isPending}
          >
            Confirm reject
          </Button>
        </div>
      )}

      <ActionMessage message={message} className="mt-3" />
    </div>
  );
}
