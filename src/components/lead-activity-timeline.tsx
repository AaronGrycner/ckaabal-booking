"use client";

import { useState } from "react";
import type { LeadActivity } from "@/lib/db/schema";
import { contactMethodLabel } from "@/lib/crm-utils";
import { formatCrmDateTime } from "@/lib/crm-utils";

function activityTypeLabel(type: LeadActivity["activityType"]) {
  switch (type) {
    case "status_change":
      return "Status";
    case "contact_logged":
      return "Contact";
    case "follow_up_scheduled":
      return "Follow-up";
    case "reply_received":
      return "Reply";
    case "note_added":
      return "Note";
    case "review_changed":
      return "Review";
    case "outcome_changed":
      return "Outcome";
    case "outreach_email_generated":
      return "Email draft";
    case "outreach_email_premium_polished":
      return "Email polished";
    case "outreach_link_clicked":
      return "Clicked email link";
    default:
      return "Activity";
  }
}

function parseMessageSent(metadataJson: string | null): string | null {
  if (!metadataJson) return null;
  try {
    const meta = JSON.parse(metadataJson) as { messageSent?: string };
    return meta.messageSent?.trim() ?? null;
  } catch {
    return null;
  }
}

function truncate(text: string, max = 80) {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export function LeadActivityTimeline({
  activities,
}: {
  activities: LeadActivity[];
}) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  if (!activities.length) {
    return (
      <p className="text-sm text-zinc-500">
        No activity yet — log your first contact below.
      </p>
    );
  }

  function toggleExpand(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <ol className="space-y-3">
      {activities.map((activity) => {
        const messageSent = parseMessageSent(activity.metadataJson);
        const isExpanded = expandedIds.has(activity.id);

        return (
          <li
            key={activity.id}
            className="border-l-2 border-zinc-800 pl-4 pb-1"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span className="font-medium text-zinc-400">
                {activityTypeLabel(activity.activityType)}
              </span>
              <span>{formatCrmDateTime(activity.createdAt)}</span>
              {activity.contactMethod && (
                <span>· {contactMethodLabel(activity.contactMethod)}</span>
              )}
            </div>
            <p className="mt-1 text-sm text-zinc-300">{activity.summary}</p>
            {messageSent && (
              <div className="mt-2 text-sm text-zinc-400">
                <button
                  type="button"
                  onClick={() => toggleExpand(activity.id)}
                  className="text-left hover:text-zinc-200"
                >
                  Message sent:{" "}
                  {isExpanded ? messageSent : truncate(messageSent)}
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
