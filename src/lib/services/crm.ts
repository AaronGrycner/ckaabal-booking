import { desc, eq } from "drizzle-orm";
import type { getDb } from "@/lib/db";
import {
  leadActivities,
  leads,
  type ActivityType,
  type ContactMethod,
  type LeadStatus,
  type Outcome,
  type ReviewStatus,
} from "@/lib/db/schema";
import {
  contactMethodLabel,
  formatCrmDateTime,
  isLaterPipelineStatus,
  outcomeLabel,
  resolveFollowUpDays,
  reviewStatusLabel,
  statusLabel,
} from "@/lib/crm-utils";
import type {
  OutreachGenerationActivityMetadata,
  OutreachPremiumPolishActivityMetadata,
} from "@/lib/services/outreach-email-generate";

type Db = ReturnType<typeof getDb>;

type RecordActivityInput = {
  leadId: number;
  activityType: ActivityType;
  summary: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  contactMethod?: ContactMethod | null;
  metadataJson?: string | null;
};

export async function recordActivity(db: Db, input: RecordActivityInput) {
  await db.insert(leadActivities).values({
    leadId: input.leadId,
    activityType: input.activityType,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    contactMethod: input.contactMethod ?? null,
    summary: input.summary,
    metadataJson: input.metadataJson ?? null,
  });
}

export async function getLeadActivities(db: Db, leadId: number) {
  return db.query.leadActivities.findMany({
    where: eq(leadActivities.leadId, leadId),
    orderBy: [desc(leadActivities.createdAt)],
  });
}

export async function applyStatusChange(
  db: Db,
  leadId: number,
  toStatus: LeadStatus,
) {
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead || lead.status === toStatus) return;

  const fromStatus = lead.status;
  const updates: Partial<typeof leads.$inferInsert> = {
    status: toStatus,
    updatedAt: new Date(),
  };

  if (toStatus === "replied" && !lead.replyReceivedAt) {
    updates.replyReceivedAt = new Date();
  }

  await db.update(leads).set(updates).where(eq(leads.id, leadId));

  await recordActivity(db, {
    leadId,
    activityType: "status_change",
    fromStatus,
    toStatus,
    summary: `Status changed to ${statusLabel(toStatus)}`,
  });

  if (toStatus === "replied" && !lead.replyReceivedAt) {
    await recordActivity(db, {
      leadId,
      activityType: "reply_received",
      summary: "Reply received",
    });
  }
}

export async function applyReviewChange(
  db: Db,
  leadId: number,
  input: {
    reviewStatus: ReviewStatus;
    rejectionReason?: string | null;
  },
) {
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead || lead.reviewStatus === input.reviewStatus) return;

  const now = new Date();
  const updates: Partial<typeof leads.$inferInsert> = {
    reviewStatus: input.reviewStatus,
    rejectionReason:
      input.reviewStatus === "rejected"
        ? (input.rejectionReason?.trim() ?? null)
        : null,
    updatedAt: now,
  };

  if (lead.reviewStatus === "unreviewed") {
    updates.reviewedAt = now;
  }

  await db.update(leads).set(updates).where(eq(leads.id, leadId));

  const reasonSuffix =
    input.reviewStatus === "rejected" && input.rejectionReason?.trim()
      ? ` — ${input.rejectionReason.trim()}`
      : "";

  await recordActivity(db, {
    leadId,
    activityType: "review_changed",
    summary: `Review: ${reviewStatusLabel(input.reviewStatus)}${reasonSuffix}`,
  });
}

const OUTCOME_STATUS_MAP: Partial<Record<Outcome, LeadStatus>> = {
  positive_reply: "replied",
  meeting_booked: "meeting_scheduled",
  closed_won: "client",
  closed_lost: "not_interested",
  bad_fit: "not_fit",
};

export async function applyOutcomeChange(
  db: Db,
  leadId: number,
  outcome: Outcome,
) {
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead || lead.outcome === outcome) return;

  await db
    .update(leads)
    .set({ outcome, updatedAt: new Date() })
    .where(eq(leads.id, leadId));

  await recordActivity(db, {
    leadId,
    activityType: "outcome_changed",
    summary: `Outcome set to ${outcomeLabel(outcome)}`,
  });

  const targetStatus = OUTCOME_STATUS_MAP[outcome];
  if (targetStatus) {
    await applyStatusChange(db, leadId, targetStatus);
  }
}

export async function logContact(
  db: Db,
  leadId: number,
  input: {
    method: ContactMethod;
    note?: string;
    messageSent?: string;
    followUpDays?: number;
    clearFollowUp?: boolean;
  },
) {
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) return;

  const now = new Date();
  const methodLabel = contactMethodLabel(input.method);
  const leadStatus = lead.status as LeadStatus;
  const laterPipeline = isLaterPipelineStatus(leadStatus);
  const updates: Partial<typeof leads.$inferInsert> = {
    lastContactedAt: now,
    lastContactMethod: input.method,
    updatedAt: now,
  };

  if (!lead.firstContactedAt) {
    updates.firstContactedAt = now;
  }

  if (input.clearFollowUp && lead.followUpDueAt) {
    updates.followUpDueAt = null;
    if (leadStatus === "follow_up_due" && !laterPipeline) {
      updates.status = "contacted";
    }
  }

  const followUpDays = resolveFollowUpDays(input.followUpDays);

  if (followUpDays != null && followUpDays > 0 && !laterPipeline) {
    const due = new Date(now);
    due.setDate(due.getDate() + followUpDays);
    updates.followUpDueAt = due;
    updates.status = "contacted";
  } else if (!laterPipeline && updates.status !== "contacted") {
    updates.status = "contacted";
  }

  await db.update(leads).set(updates).where(eq(leads.id, leadId));

  const noteSuffix = input.note?.trim() ? ` — ${input.note.trim()}` : "";
  const metadata: Record<string, unknown> = {
    contactMethod: input.method,
  };
  if (input.messageSent?.trim()) {
    metadata.messageSent = input.messageSent.trim();
  }
  if (input.note?.trim()) {
    metadata.note = input.note.trim();
  }
  if (followUpDays != null && followUpDays > 0) {
    metadata.followUpDays = followUpDays;
    metadata.followUpDueAt = updates.followUpDueAt?.toISOString();
  }

  await recordActivity(db, {
    leadId,
    activityType: "contact_logged",
    contactMethod: input.method,
    toStatus: updates.status ?? lead.status,
    summary: `Contact logged via ${methodLabel}${noteSuffix}`,
    metadataJson: JSON.stringify(metadata),
  });

  if (followUpDays != null && followUpDays > 0 && !laterPipeline) {
    await recordActivity(db, {
      leadId,
      activityType: "follow_up_scheduled",
      summary: `Follow-up scheduled in ${followUpDays} day${followUpDays === 1 ? "" : "s"}`,
      metadataJson: JSON.stringify({
        followUpDays,
        followUpDueAt: updates.followUpDueAt?.toISOString(),
      }),
    });
  }
}

export async function scheduleFollowUp(
  db: Db,
  leadId: number,
  dueAt: Date,
  note?: string,
) {
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) return;

  const status =
    dueAt.getTime() <= Date.now() ? "follow_up_due" : "contacted";

  await db
    .update(leads)
    .set({
      followUpDueAt: dueAt,
      status,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, leadId));

  const noteSuffix = note?.trim() ? ` — ${note.trim()}` : "";
  await recordActivity(db, {
    leadId,
    activityType: "follow_up_scheduled",
    summary: `Follow-up due ${formatCrmDateTime(dueAt)}${noteSuffix}`,
    metadataJson: note?.trim()
      ? JSON.stringify({ note: note.trim(), followUpDueAt: dueAt.toISOString() })
      : JSON.stringify({ followUpDueAt: dueAt.toISOString() }),
  });
}

export async function logOutreachEmailGenerated(
  db: Db,
  leadId: number,
  metadata: OutreachGenerationActivityMetadata,
) {
  const angleSuffix = metadata.selectedIssue?.trim()
    ? `: ${metadata.selectedIssue.trim()}`
    : "";

  await recordActivity(db, {
    leadId,
    activityType: "outreach_email_generated",
    summary: `Outreach email generated${angleSuffix}`,
    metadataJson: JSON.stringify(metadata),
  });
}

export async function logOutreachEmailPremiumPolished(
  db: Db,
  leadId: number,
  metadata: OutreachPremiumPolishActivityMetadata,
) {
  const angleSuffix = metadata.selectedIssue?.trim()
    ? `: ${metadata.selectedIssue.trim()}`
    : "";

  await recordActivity(db, {
    leadId,
    activityType: "outreach_email_premium_polished",
    summary: `Outreach email premium polished${angleSuffix}`,
    metadataJson: JSON.stringify(metadata),
  });
}
