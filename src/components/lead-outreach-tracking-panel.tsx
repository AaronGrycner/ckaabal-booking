"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Lead, TrackedOutreachLink } from "@/lib/db/schema";
import { formatCrmDateTime } from "@/lib/crm-utils";
import { copyTextToClipboard, copyTextToClipboardSync } from "@/lib/utils";

export function LeadOutreachTrackingPanel({
  lead,
  signatureLink,
  trackedUrl,
}: {
  lead: Lead;
  signatureLink: TrackedOutreachLink | null;
  trackedUrl: string | null;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  const clicked = lead.lastEmailClickedAt != null;

  function copyTrackedLink() {
    if (!trackedUrl) return;

    if (copyTextToClipboardSync(trackedUrl)) {
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
      return;
    }

    void copyTextToClipboard(trackedUrl)
      .then(() => {
        setCopyState("copied");
        setTimeout(() => setCopyState("idle"), 2000);
      })
      .catch(() => {
        setCopyState("error");
        setTimeout(() => setCopyState("idle"), 2000);
      });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Email link tracking</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <p>
            <span className="text-zinc-500">Email clicked:</span>{" "}
            <span className={clicked ? "text-emerald-400" : "text-zinc-300"}>
              {clicked ? "Yes" : "No"}
            </span>
          </p>
          <p>
            <span className="text-zinc-500">Last clicked:</span>{" "}
            {formatCrmDateTime(lead.lastEmailClickedAt) || "—"}
          </p>
          <p>
            <span className="text-zinc-500">Total clicks:</span>{" "}
            {lead.emailClickCount}
          </p>
          <p>
            <span className="text-zinc-500">Link type:</span>{" "}
            {signatureLink?.linkType ?? "signature"}
          </p>
        </div>

        {trackedUrl ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={copyTrackedLink}
            >
              {copyState === "copied"
                ? "Copied!"
                : copyState === "error"
                  ? "Copy failed"
                  : "Copy tracked link"}
            </Button>
            <span className="truncate text-xs text-zinc-500">{trackedUrl}</span>
          </div>
        ) : (
          <p className="text-xs text-zinc-500">
            Tracked link is created when you send the first outreach email.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
