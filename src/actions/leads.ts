"use server";

import { after } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import {
  leads,
  leadStatuses,
  outcomes,
  reviewStatuses,
  sourceTypes,
  type LeadStatus,
  type Outcome,
  type ReviewStatus,
  type SourceType,
} from "@/lib/db/schema";
import { isContactMethod } from "@/lib/crm-utils";
import {
  applyOutcomeChange,
  applyReviewChange,
  applyStatusChange,
  logContact,
  scheduleFollowUp,
} from "@/lib/services/crm";
import {
  applyPreliminaryScore,
  auditLead,
} from "@/lib/services/audit-queue";
import { buildDedupeKey } from "@/lib/services/dedupe";

async function revalidateLeadPaths(leadId: number, searchRunId?: number | null) {
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/pipeline");
  revalidatePath("/ready");
  revalidatePath("/follow-ups");
  revalidatePath("/call-list");
  revalidatePath("/analytics");
  revalidatePath("/");
  if (searchRunId != null) {
    revalidatePath(`/search/${searchRunId}`);
  }
}

function parseLeadId(formData: FormData): number | null {
  const raw = formData.get("leadId");
  const leadId =
    typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isNaN(leadId) ? null : leadId;
}

function parseLeadIds(formData: FormData): number[] {
  const raw = String(formData.get("leadIds") ?? "").trim();
  if (!raw) return [];

  return [
    ...new Set(
      raw
        .split(",")
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((id) => !Number.isNaN(id)),
    ),
  ];
}

async function revalidateAfterLeadDeletes(searchRunIds: Array<number | null>) {
  revalidatePath("/pipeline");
  revalidatePath("/ready");
  revalidatePath("/follow-ups");
  revalidatePath("/call-list");
  revalidatePath("/analytics");
  revalidatePath("/");

  for (const runId of new Set(searchRunIds.filter((id) => id != null))) {
    revalidatePath(`/search/${runId}`);
  }
}

export async function deleteLead(leadId: number) {
  const db = getDb();
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) return;

  await db.delete(leads).where(eq(leads.id, leadId));
  await revalidateAfterLeadDeletes([lead.searchRunId]);
}

export async function deleteLeadAction(formData: FormData) {
  const leadId = parseLeadId(formData);
  if (leadId == null) return;
  await deleteLead(leadId);
}

export async function deleteLeadsAction(formData: FormData) {
  const leadIds = parseLeadIds(formData);
  if (!leadIds.length) return;

  const db = getDb();
  const toDelete = await db.query.leads.findMany({
    where: inArray(leads.id, leadIds),
  });
  if (!toDelete.length) return;

  await db.delete(leads).where(inArray(leads.id, leadIds));
  await revalidateAfterLeadDeletes(toDelete.map((lead) => lead.searchRunId));
}

export async function updateLeadStatus(leadId: number, status: LeadStatus) {
  const db = getDb();
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) return;

  await applyStatusChange(db, leadId, status);
  await revalidateLeadPaths(leadId, lead.searchRunId);
}

export async function updateLeadStatusAction(formData: FormData) {
  const leadId = parseLeadId(formData);
  const status = String(formData.get("status") ?? "") as LeadStatus;
  if (leadId == null || !leadStatuses.includes(status)) return;
  await updateLeadStatus(leadId, status);
}

export async function logContactAction(formData: FormData) {
  const leadId = parseLeadId(formData);
  if (leadId == null) return;

  const methodRaw = String(formData.get("method") ?? "");
  if (!isContactMethod(methodRaw)) return;

  const note = String(formData.get("note") ?? "").trim() || undefined;
  const messageSent =
    String(formData.get("messageSent") ?? "").trim() || undefined;
  const followUpDaysRaw = String(formData.get("followUpDays") ?? "").trim();
  const followUpDays = followUpDaysRaw
    ? Number.parseInt(followUpDaysRaw, 10)
    : undefined;

  const db = getDb();
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) return;

  await logContact(db, leadId, {
    method: methodRaw,
    note,
    messageSent,
    followUpDays:
      followUpDaysRaw === "0"
        ? 0
        : followUpDays != null && !Number.isNaN(followUpDays)
          ? followUpDays
          : undefined,
  });

  await revalidateLeadPaths(leadId, lead.searchRunId);
}

export async function scheduleFollowUpAction(formData: FormData) {
  const leadId = parseLeadId(formData);
  if (leadId == null) return;

  const dueRaw = String(formData.get("followUpDueAt") ?? "").trim();
  if (!dueRaw) return;

  const dueAt = new Date(dueRaw);
  if (Number.isNaN(dueAt.getTime())) return;

  const note = String(formData.get("note") ?? "").trim() || undefined;
  const db = getDb();
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) return;

  await scheduleFollowUp(db, leadId, dueAt, note);
  await revalidateLeadPaths(leadId, lead.searchRunId);
}

export async function updateLeadNotes(leadId: number, notes: string) {
  const db = getDb();
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) return;

  await db
    .update(leads)
    .set({ notes, updatedAt: new Date() })
    .where(eq(leads.id, leadId));

  if (notes.trim() && notes.trim() !== (lead.notes ?? "").trim()) {
    const { recordActivity } = await import("@/lib/services/crm");
    await recordActivity(db, {
      leadId,
      activityType: "note_added",
      summary: "Notes updated",
    });
  }

  await revalidateLeadPaths(leadId, lead.searchRunId);
}

export async function saveLeadNotesAction(formData: FormData) {
  const leadId = parseLeadId(formData);
  if (leadId == null) return;
  await updateLeadNotes(leadId, String(formData.get("notes") ?? ""));
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function updateLeadContactEmail(
  leadId: number,
  contactEmail: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = contactEmail.trim();

  if (trimmed && !isValidEmail(trimmed)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const db = getDb();
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) {
    return { ok: false, error: "Lead not found." };
  }

  await db
    .update(leads)
    .set({
      contactEmail: trimmed || null,
      emailSource: trimmed ? "manual" : null,
      emailConfidence: null,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, leadId));

  await revalidateLeadPaths(leadId, lead.searchRunId);
  return { ok: true };
}

export async function updateLeadContactEmailAction(formData: FormData) {
  const leadId = parseLeadId(formData);
  if (leadId == null) return;
  await updateLeadContactEmail(
    leadId,
    String(formData.get("contactEmail") ?? ""),
  );
}

export async function setCallList(leadId: number, onCallList: boolean) {
  const db = getDb();
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) return;

  await db
    .update(leads)
    .set({
      onCallList,
      callListAddedAt: onCallList ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, leadId));

  await revalidateLeadPaths(leadId, lead.searchRunId);
}

export async function setCallListAction(formData: FormData) {
  const leadId = parseLeadId(formData);
  if (leadId == null) return;
  const onCallList = formData.get("onCallList") === "true";
  await setCallList(leadId, onCallList);
}

export async function updateReviewStatus(
  leadId: number,
  reviewStatus: ReviewStatus,
  rejectionReason?: string,
) {
  if (!reviewStatuses.includes(reviewStatus)) return;

  const db = getDb();
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) return;

  await applyReviewChange(db, leadId, {
    reviewStatus,
    rejectionReason,
  });
  await revalidateLeadPaths(leadId, lead.searchRunId);
}

export async function updateReviewStatusAction(formData: FormData) {
  const leadIdRaw = formData.get("leadId");
  const leadId =
    typeof leadIdRaw === "string"
      ? Number.parseInt(leadIdRaw, 10)
      : Number.NaN;
  if (Number.isNaN(leadId)) return;

  const reviewStatus = String(formData.get("reviewStatus") ?? "") as ReviewStatus;
  const rejectionReason =
    String(formData.get("rejectionReason") ?? "").trim() || undefined;
  await updateReviewStatus(leadId, reviewStatus, rejectionReason);
}

export async function updateOutcome(leadId: number, outcome: Outcome) {
  if (!outcomes.includes(outcome)) return;

  const db = getDb();
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) return;

  await applyOutcomeChange(db, leadId, outcome);
  await revalidateLeadPaths(leadId, lead.searchRunId);
}

export type CreateManualLeadState = {
  error?: string;
};

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

type ManualLeadInput = {
  businessName: string;
  city: string | null;
  category: string | null;
  websiteUrl: string | null;
  phone: string | null;
  contactEmail: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  sourceType: SourceType;
  sourceQuery: string;
};

async function insertManualLead(input: ManualLeadInput) {
  const dedupeKey = buildDedupeKey({
    businessName: input.businessName,
    phone: input.phone,
    websiteUrl: input.websiteUrl,
  });

  const auditStatus = input.websiteUrl ? "pending" : "skipped";

  const db = getDb();
  const [lead] = await db
    .insert(leads)
    .values({
      businessName: input.businessName,
      city: input.city,
      category: input.category,
      websiteUrl: input.websiteUrl,
      phone: input.phone,
      contactEmail: input.contactEmail,
      instagramUrl: input.instagramUrl,
      facebookUrl: input.facebookUrl,
      linkedinUrl: input.linkedinUrl,
      notes: input.notes,
      sourceType: input.sourceType,
      sourceQuery: input.sourceQuery,
      auditStatus,
      dedupeKey,
    })
    .returning();

  await applyPreliminaryScore(lead.id);

  if (input.websiteUrl) {
    after(async () => {
      await auditLead(lead.id);
    });
  }

  return lead;
}

function isNextRedirectError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "digest" in error &&
    String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

export async function createManualLead(
  _prev: CreateManualLeadState,
  formData: FormData,
): Promise<CreateManualLeadState> {
  const businessName = String(formData.get("businessName") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim() || null;
  const category = String(formData.get("category") ?? "").trim() || null;
  const websiteUrl = normalizeUrl(String(formData.get("websiteUrl") ?? ""));
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const contactEmail =
    String(formData.get("contactEmail") ?? "").trim() || null;
  const instagramUrl = normalizeUrl(String(formData.get("instagramUrl") ?? ""));
  const facebookUrl = normalizeUrl(String(formData.get("facebookUrl") ?? ""));
  const linkedinUrl = normalizeUrl(String(formData.get("linkedinUrl") ?? ""));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const sourceTypeRaw = String(formData.get("sourceType") ?? "manual");
  const sourceType = sourceTypes.includes(sourceTypeRaw as SourceType)
    ? (sourceTypeRaw as SourceType)
    : "manual";

  if (!businessName) {
    return { error: "Venue name is required." };
  }

  try {
    const lead = await insertManualLead({
      businessName,
      city,
      category,
      websiteUrl,
      phone,
      contactEmail,
      instagramUrl,
      facebookUrl,
      linkedinUrl,
      notes,
      sourceType,
      sourceQuery: "Manual entry",
    });

    redirect(`/leads/${lead.id}`);
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    return { error: "Could not save lead — it may already exist." };
  }
}
