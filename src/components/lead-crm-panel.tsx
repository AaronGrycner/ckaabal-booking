"use client";

import { logContactAction, updateLeadStatusAction } from "@/actions/leads";
import { LeadActivityTimeline } from "@/components/lead-activity-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Lead, LeadActivity } from "@/lib/db/schema";
import {
  contactMethodLabel,
  formatCrmDate,
  formatCrmDateTime,
  getDuplicateOutreachWarning,
  STATUS_GROUPS,
  statusBadgeVariant,
  statusLabel,
  getEffectiveLeadStatus,
  followUpDueFieldLabel,
} from "@/lib/crm-utils";
import { contactMethods } from "@/lib/db/schema";

export function LeadCrmPanel({
  lead,
  activities,
  defaultFollowUpDays,
}: {
  lead: Lead;
  activities: LeadActivity[];
  defaultFollowUpDays: number;
}) {
  const warning = getDuplicateOutreachWarning(lead);
  const displayStatus = getEffectiveLeadStatus(lead);

  return (
    <div className="space-y-4">
      {warning && (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          {warning}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">CRM</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-zinc-500">Current status:</span>
            <Badge variant={statusBadgeVariant(displayStatus)}>
              {statusLabel(displayStatus)}
            </Badge>
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-zinc-500">First contact:</span>{" "}
              {formatCrmDateTime(lead.firstContactedAt)}
            </p>
            <p>
              <span className="text-zinc-500">Last contact:</span>{" "}
              {formatCrmDateTime(lead.lastContactedAt)}
            </p>
            <p>
              <span className="text-zinc-500">{followUpDueFieldLabel(lead)}</span>{" "}
              {formatCrmDate(lead.followUpDueAt)}
            </p>
            <p>
              <span className="text-zinc-500">Last method:</span>{" "}
              {contactMethodLabel(lead.lastContactMethod)}
            </p>
            <p>
              <span className="text-zinc-500">Reply received:</span>{" "}
              {formatCrmDateTime(lead.replyReceivedAt)}
            </p>
          </div>

          <div className="space-y-3">
            {STATUS_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.statuses.map((status) => (
                    <form key={status} action={updateLeadStatusAction}>
                      <input type="hidden" name="leadId" value={lead.id} />
                      <input type="hidden" name="status" value={status} />
                      <Button
                        type="submit"
                        size="sm"
                        variant={
                          displayStatus === status ? "default" : "outline"
                        }
                      >
                        {statusLabel(status)}
                      </Button>
                    </form>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <form action={logContactAction} className="space-y-3 border-t border-zinc-800 pt-4">
            <input type="hidden" name="leadId" value={lead.id} />
            <p className="text-sm font-medium text-zinc-300">Log contact</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                name="method"
                required
                defaultValue="email"
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
                min={0}
                max={365}
                placeholder={`Default: ${defaultFollowUpDays} days (0 = none)`}
                className="h-9 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
              />
            </div>
            <textarea
              name="messageSent"
              rows={3}
              placeholder="Message sent (optional) — what you manually sent…"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            />
            <textarea
              name="note"
              rows={2}
              placeholder="Optional note…"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            />
            <Button type="submit" size="sm">
              Log contact
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadActivityTimeline activities={activities} />
        </CardContent>
      </Card>
    </div>
  );
}
