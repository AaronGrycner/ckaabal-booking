"use client";

import Link from "next/link";
import { Fragment, useRef, useState } from "react";
import {
  logContactForLead,
  updateLeadStatus,
} from "@/actions/leads";
import { ActionMessage } from "@/components/action-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Lead, LeadActivity } from "@/lib/db/schema";
import { contactMethods, type ContactMethod } from "@/lib/db/schema";
import {
  contactMethodLabel,
  formatCrmDate,
  formatCrmDateTime,
  getLastMessageSent,
  statusBadgeVariant,
  statusLabel,
  getEffectiveLeadStatus,
} from "@/lib/crm-utils";
import { GenerateFollowUpEmailButton } from "@/components/generate-follow-up-email-button";
import { copyTextToClipboard, copyTextToClipboardSync } from "@/lib/utils";
import { useActionRunner } from "@/hooks/use-action-runner";

export type FollowUpLeadRow = Lead & {
  activities: LeadActivity[];
};

export function FollowUpsTable({ leads }: { leads: FollowUpLeadRow[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copyFailedId, setCopyFailedId] = useState<number | null>(null);
  const followUpFormRef = useRef<HTMLFormElement>(null);
  const { isPending, message, run } = useActionRunner();

  function copyMessage(lead: FollowUpLeadRow) {
    const messageText = getLastMessageSent(lead.activities);
    if (!messageText) return;

    if (copyTextToClipboardSync(messageText)) {
      setCopiedId(lead.id);
      setCopyFailedId(null);
      setTimeout(() => setCopiedId(null), 2000);
      return;
    }

    void copyTextToClipboard(messageText)
      .then(() => {
        setCopiedId(lead.id);
        setCopyFailedId(null);
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch(() => {
        setCopyFailedId(lead.id);
        setTimeout(() => setCopyFailedId(null), 2500);
      });
  }

  function submitFollowUpForm(leadId: number) {
    const form = followUpFormRef.current;
    if (!form) return;
    const formData = new FormData(form);
    run(async () => {
      const result = await logContactForLead(leadId, {
        method: String(formData.get("method") ?? "") as ContactMethod,
        messageSent: String(formData.get("messageSent") ?? ""),
        followUpDaysRaw: String(formData.get("followUpDays") ?? ""),
      });
      if (result.ok) setExpandedId(null);
      return result;
    });
  }

  return (
    <div className="space-y-3">
      <ActionMessage message={message} />
      <div className="rounded-lg border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Venue</TableHead>
              <TableHead>Last method</TableHead>
              <TableHead>Last contacted</TableHead>
              <TableHead>Follow-up due</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <Fragment key={lead.id}>
                <TableRow>
                  <TableCell className="font-medium">
                    <Link href={`/leads/${lead.id}`}>{lead.businessName}</Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {contactMethodLabel(lead.lastContactMethod)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatCrmDateTime(lead.lastContactedAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatCrmDate(lead.followUpDueAt)}
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate text-sm">
                    {lead.contactEmail ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">{lead.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(getEffectiveLeadStatus(lead))}>
                      {statusLabel(getEffectiveLeadStatus(lead))}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/leads/${lead.id}`}>View</Link>
                      </Button>
                      <GenerateFollowUpEmailButton
                        leadId={lead.id}
                        variant="ghost"
                        redirectOnSuccess
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => copyMessage(lead)}
                        disabled={!getLastMessageSent(lead.activities)}
                      >
                        {copiedId === lead.id
                          ? "Copied"
                          : copyFailedId === lead.id
                            ? "Copy failed"
                            : "Copy message"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() =>
                          setExpandedId(expandedId === lead.id ? null : lead.id)
                        }
                      >
                        Log follow-up
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          run(() => updateLeadStatus(lead.id, "replied"))
                        }
                      >
                        Mark replied
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          run(() => updateLeadStatus(lead.id, "not_interested"))
                        }
                      >
                        Not interested
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {expandedId === lead.id && (
                  <TableRow key={`${lead.id}-followup`}>
                    <TableCell colSpan={8}>
                      <form
                        ref={followUpFormRef}
                        className="space-y-2 rounded-md border border-zinc-800 bg-zinc-950/50 p-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          submitFollowUpForm(lead.id);
                        }}
                      >
                        <p className="text-sm font-medium">Log follow-up</p>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <select
                            name="method"
                            defaultValue={lead.lastContactMethod ?? "email"}
                            className="h-9 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
                          >
                            {contactMethods.map((method) => (
                              <option key={method} value={method}>
                                {contactMethodLabel(method)}
                              </option>
                            ))}
                          </select>
                          <input
                            name="followUpDays"
                            type="number"
                            min={1}
                            max={365}
                            placeholder="Default: 3 days (0 = none)"
                            className="h-9 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
                          />
                        </div>
                        <textarea
                          name="messageSent"
                          rows={3}
                          placeholder="Follow-up message sent (optional)…"
                          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                        />
                        <Button type="submit" size="sm" disabled={isPending}>
                          {isPending ? "Saving…" : "Save follow-up"}
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
            {!leads.length && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-zinc-500">
                  No follow-ups due.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
