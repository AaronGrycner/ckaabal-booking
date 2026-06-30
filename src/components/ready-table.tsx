"use client";

import Link from "next/link";
import { Fragment, useRef, useState } from "react";
import {
  logContactForLead,
  updateReviewStatus,
} from "@/actions/leads";
import { ContactAvailabilityBadges } from "@/components/contact-availability-badges";
import { CopyLeadSummaryButton } from "@/components/copy-lead-summary-button";
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
import type { Lead, WebsiteAudit } from "@/lib/db/schema";
import { contactMethods, type ContactMethod } from "@/lib/db/schema";
import {
  bestContactMethodToLogMethod,
  contactAvailabilityLabel,
  contactMethodLabel,
  getContactAvailability,
  statusBadgeVariant,
  statusLabel,
  getEffectiveLeadStatus,
} from "@/lib/crm-utils";
import { useActionRunner } from "@/hooks/use-action-runner";

export type ReadyLeadRow = Lead & { latestAudit?: WebsiteAudit | null };

type ExpandedPanel = { leadId: number; mode: "contact" | "reject" };

export function ReadyTable({ leads }: { leads: ReadyLeadRow[] }) {
  const [expanded, setExpanded] = useState<ExpandedPanel | null>(null);
  const contactFormRef = useRef<HTMLFormElement>(null);
  const rejectFormRef = useRef<HTMLFormElement>(null);
  const { isPending, message, run } = useActionRunner();

  function togglePanel(leadId: number, mode: ExpandedPanel["mode"]) {
    setExpanded((current) =>
      current?.leadId === leadId && current.mode === mode
        ? null
        : { leadId, mode },
    );
  }

  function submitContactForm(leadId: number) {
    const form = contactFormRef.current;
    if (!form) return;
    const formData = new FormData(form);
    run(async () => {
      const result = await logContactForLead(leadId, {
        method: String(formData.get("method") ?? "") as ContactMethod,
        note: String(formData.get("note") ?? ""),
        messageSent: String(formData.get("messageSent") ?? ""),
        followUpDaysRaw: String(formData.get("followUpDays") ?? ""),
      });
      if (result.ok) setExpanded(null);
      return result;
    });
  }

  function submitRejectForm(leadId: number) {
    const form = rejectFormRef.current;
    if (!form) return;
    const formData = new FormData(form);
    run(async () => {
      const result = await updateReviewStatus(
        leadId,
        "rejected",
        String(formData.get("rejectionReason") ?? "").trim() || undefined,
      );
      if (result.ok) setExpanded(null);
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
              <TableHead>Fit</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Best contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Website</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => {
              const availability = getContactAvailability(lead, lead.latestAudit);
              const defaultMethod =
                bestContactMethodToLogMethod(availability.bestContactMethod) ??
                "email";

              return (
                <Fragment key={lead.id}>
                  <TableRow>
                    <TableCell>{lead.fitScore ?? "—"}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/leads/${lead.id}`}>{lead.businessName}</Link>
                      <div className="mt-1">
                        <ContactAvailabilityBadges
                          lead={lead}
                          audit={lead.latestAudit}
                          showBest={false}
                        />
                      </div>
                    </TableCell>
                    <TableCell>{lead.city ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {contactAvailabilityLabel(availability.bestContactMethod)}
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate text-sm">
                      {lead.contactEmail ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{lead.phone ?? "—"}</TableCell>
                    <TableCell>
                      {lead.websiteUrl ? (
                        <a
                          href={lead.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs"
                        >
                          Link
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
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
                        <CopyLeadSummaryButton
                          lead={lead}
                          audit={lead.latestAudit}
                          variant="ghost"
                          label="Copy summary"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => togglePanel(lead.id, "contact")}
                        >
                          Log contact
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            run(() =>
                              logContactForLead(lead.id, {
                                method: defaultMethod,
                              }),
                            )
                          }
                        >
                          Mark contacted
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => togglePanel(lead.id, "reject")}
                        >
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expanded?.leadId === lead.id && expanded.mode === "contact" && (
                    <TableRow key={`${lead.id}-contact`}>
                      <TableCell colSpan={9}>
                        <form
                          ref={contactFormRef}
                          className="space-y-2 rounded-md border border-zinc-800 bg-zinc-950/50 p-3"
                          onSubmit={(event) => {
                            event.preventDefault();
                            submitContactForm(lead.id);
                          }}
                        >
                          <p className="text-sm font-medium">Log contact</p>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <select
                              name="method"
                              defaultValue={defaultMethod}
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
                              placeholder="Follow up in N days"
                              className="h-9 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
                            />
                          </div>
                          <textarea
                            name="messageSent"
                            rows={3}
                            placeholder="Message sent (optional)…"
                            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                          />
                          <textarea
                            name="note"
                            rows={2}
                            placeholder="Optional note…"
                            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                          />
                          <Button type="submit" size="sm" disabled={isPending}>
                            {isPending ? "Saving…" : "Save contact"}
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  )}
                  {expanded?.leadId === lead.id && expanded.mode === "reject" && (
                    <TableRow key={`${lead.id}-reject`}>
                      <TableCell colSpan={9}>
                        <form
                          ref={rejectFormRef}
                          className="space-y-2 rounded-md border border-zinc-800 bg-zinc-950/50 p-3"
                          onSubmit={(event) => {
                            event.preventDefault();
                            submitRejectForm(lead.id);
                          }}
                        >
                          <p className="text-sm font-medium">Reject lead</p>
                          <textarea
                            name="rejectionReason"
                            rows={2}
                            placeholder="Optional reason…"
                            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                          />
                          <Button
                            type="submit"
                            size="sm"
                            variant="secondary"
                            disabled={isPending}
                          >
                            {isPending ? "Saving…" : "Confirm reject"}
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
            {!leads.length && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-zinc-500">
                  No leads ready to contact.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
