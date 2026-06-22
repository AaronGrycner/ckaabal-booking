"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { logContactAction, updateLeadStatusAction } from "@/actions/leads";
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
import { contactMethods } from "@/lib/db/schema";
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

export type FollowUpLeadRow = Lead & {
  activities: LeadActivity[];
};

export function FollowUpsTable({ leads }: { leads: FollowUpLeadRow[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copyFailedId, setCopyFailedId] = useState<number | null>(null);

  function copyMessage(lead: FollowUpLeadRow) {
    const message = getLastMessageSent(lead.activities);
    if (!message) return;

    if (copyTextToClipboardSync(message)) {
      setCopiedId(lead.id);
      setCopyFailedId(null);
      setTimeout(() => setCopiedId(null), 2000);
      return;
    }

    void copyTextToClipboard(message)
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

  return (
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
                    <form action={updateLeadStatusAction}>
                      <input type="hidden" name="leadId" value={lead.id} />
                      <input type="hidden" name="status" value="replied" />
                      <Button variant="ghost" size="sm" type="submit">
                        Mark replied
                      </Button>
                    </form>
                    <form action={updateLeadStatusAction}>
                      <input type="hidden" name="leadId" value={lead.id} />
                      <input type="hidden" name="status" value="not_interested" />
                      <Button variant="ghost" size="sm" type="submit">
                        Not interested
                      </Button>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
              {expandedId === lead.id && (
                <TableRow key={`${lead.id}-followup`}>
                  <TableCell colSpan={8}>
                    <form
                      action={logContactAction}
                      className="space-y-2 rounded-md border border-zinc-800 bg-zinc-950/50 p-3"
                    >
                      <input type="hidden" name="leadId" value={lead.id} />
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
                      <Button type="submit" size="sm">
                        Save follow-up
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
  );
}
