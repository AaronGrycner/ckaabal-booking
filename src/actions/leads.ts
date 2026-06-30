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
  type ContactMethod,
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
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  isNextRedirectError,
  runServerAction,
} from "@/lib/action-result";

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

export async function deleteLead(leadId: number): Promise<ActionResult> {
  const db = getDb();
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) {
    return actionFailure("Lead not found.");
  }

  return runServerAction(async () => {
    await db.delete(leads).where(eq(leads.id, leadId));
    await revalidateAfterLeadDeletes([lead.searchRunId]);
  }, "Could not delete lead. Try again.");
}

export async function deleteLeadAction(formData: FormData): Promise<ActionResult> {
  const leadId = parseLeadId(formData);
  if (leadId == null) {
    return actionFailure("Invalid lead.");
  }
  return deleteLead(leadId);
}

export async function deleteLeadsAction(formData: FormData): Promise<ActionResult> {
  const leadIds = parseLeadIds(formData);
  if (!leadIds.length) {
    return actionFailure("No leads selected.");
  }

  const db = getDb();
  const toDelete = await db.query.leads.findMany({
    where: inArray(leads.id, leadIds),
  });
  if (!toDelete.length) {
    return actionFailure("No matching leads found.");
  }

  return runServerAction(async () => {
    await db.delete(leads).where(inArray(leads.id, leadIds));
    await revalidateAfterLeadDeletes(toDelete.map((lead) => lead.searchRunId));
  }, "Could not delete leads. Try again.");
}

export async function updateLeadStatus(
  leadId: number,
  status: LeadStatus,
): Promise<ActionResult> {
  if (!leadStatuses.includes(status)) {
    return actionFailure("Invalid status.");
  }

  const db = getDb();
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) {
    return actionFailure("Lead not found.");
  }

  return runServerAction(async () => {
    await applyStatusChange(db, leadId, status);
    await revalidateLeadPaths(leadId, lead.searchRunId);
  }, "Could not update status. Try again.");
}

export async function updateLeadStatusAction(
  formData: FormData,
): Promise<ActionResult> {
  const leadId = parseLeadId(formData);
  const status = String(formData.get("status") ?? "") as LeadStatus;
  if (leadId == null) {
    return actionFailure("Invalid lead.");
  }
  return updateLeadStatus(leadId, status);
}

export type LogContactInput = {
  method: ContactMethod;
  note?: string;
  messageSent?: string;
  followUpDaysRaw?: string;
};

export async function logContactForLead(
  leadId: number,
  input: LogContactInput,
): Promise<ActionResult> {
  if (!isContactMethod(input.method)) {
    return actionFailure("Choose a valid contact method.");
  }

  const followUpDaysRaw = input.followUpDaysRaw?.trim() ?? "";
  const followUpDays = followUpDaysRaw
    ? Number.parseInt(followUpDaysRaw, 10)
    : undefined;

  if (
    followUpDaysRaw &&
    followUpDaysRaw !== "0" &&
    (followUpDays == null || Number.isNaN(followUpDays) || followUpDays < 0)
  ) {
    return actionFailure("Follow-up days must be a valid number.");
  }

  const db = getDb();
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) {
    return actionFailure("Lead not found.");
  }

  return runServerAction(async () => {
    await logContact(db, leadId, {
      method: input.method,
      note: input.note?.trim() || undefined,
      messageSent: input.messageSent?.trim() || undefined,
      followUpDays:
        followUpDaysRaw === "0"
          ? 0
          : followUpDays != null && !Number.isNaN(followUpDays)
            ? followUpDays
            : undefined,
    });
    await revalidateLeadPaths(leadId, lead.searchRunId);
  }, "Could not log contact. Try again.");
}

export async function logContactAction(formData: FormData): Promise<ActionResult> {
  const leadId = parseLeadId(formData);
  if (leadId == null) {
    return actionFailure("Invalid lead.");
  }

  return logContactForLead(leadId, {
    method: String(formData.get("method") ?? "") as ContactMethod,
    note: String(formData.get("note") ?? ""),
    messageSent: String(formData.get("messageSent") ?? ""),
    followUpDaysRaw: String(formData.get("followUpDays") ?? ""),
  });
}

export async function scheduleFollowUpAction(
  formData: FormData,
): Promise<ActionResult> {
  const leadId = parseLeadId(formData);
  if (leadId == null) {
    return actionFailure("Invalid lead.");
  }

  const dueRaw = String(formData.get("followUpDueAt") ?? "").trim();
  if (!dueRaw) {
    return actionFailure("Choose a follow-up date.");
  }

  const dueAt = new Date(dueRaw);
  if (Number.isNaN(dueAt.getTime())) {
    return actionFailure("Enter a valid follow-up date.");
  }

  const note = String(formData.get("note") ?? "").trim() || undefined;
  const db = getDb();
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) {
    return actionFailure("Lead not found.");
  }

  return runServerAction(async () => {
    await scheduleFollowUp(db, leadId, dueAt, note);
    await revalidateLeadPaths(leadId, lead.searchRunId);
  }, "Could not schedule follow-up. Try again.");
}

export async function updateLeadNotes(
  leadId: number,
  notes: string,
): Promise<ActionResult> {
  const db = getDb();
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) {
    return actionFailure("Lead not found.");
  }

  return runServerAction(async () => {
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
  }, "Could not save notes. Try again.");
}

export async function saveLeadNotesAction(
  formData: FormData,
): Promise<ActionResult> {
  const leadId = parseLeadId(formData);
  if (leadId == null) {
    return actionFailure("Invalid lead.");
  }
  const result = await updateLeadNotes(leadId, String(formData.get("notes") ?? ""));
  if (!result.ok) return result;
  return actionSuccess("Notes saved.");
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function updateLeadContactEmail(
  leadId: number,
  contactEmail: string,
): Promise<ActionResult> {
  const trimmed = contactEmail.trim();

  if (trimmed && !isValidEmail(trimmed)) {
    return actionFailure("Enter a valid email address.");
  }

  const db = getDb();
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) {
    return actionFailure("Lead not found.");
  }

  return runServerAction(async () => {
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
  }, "Could not save contact email. Try again.");
}

export async function updateLeadContactEmailAction(
  formData: FormData,
): Promise<ActionResult> {
  const leadId = parseLeadId(formData);
  if (leadId == null) {
    return actionFailure("Invalid lead.");
  }
  return updateLeadContactEmail(
    leadId,
    String(formData.get("contactEmail") ?? ""),
  );
}

export async function setCallList(
  leadId: number,
  onCallList: boolean,
): Promise<ActionResult> {
  const db = getDb();
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) {
    return actionFailure("Lead not found.");
  }

  return runServerAction(async () => {
    await db
      .update(leads)
      .set({
        onCallList,
        callListAddedAt: onCallList ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId));

    await revalidateLeadPaths(leadId, lead.searchRunId);
  }, "Could not update call list. Try again.");
}

export async function setCallListAction(formData: FormData): Promise<ActionResult> {
  const leadId = parseLeadId(formData);
  if (leadId == null) {
    return actionFailure("Invalid lead.");
  }
  const onCallList = formData.get("onCallList") === "true";
  return setCallList(leadId, onCallList);
}

export async function updateReviewStatus(
  leadId: number,
  reviewStatus: ReviewStatus,
  rejectionReason?: string,
): Promise<ActionResult> {
  if (!reviewStatuses.includes(reviewStatus)) {
    return actionFailure("Invalid review status.");
  }

  const db = getDb();
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) {
    return actionFailure("Lead not found.");
  }

  return runServerAction(async () => {
    await applyReviewChange(db, leadId, {
      reviewStatus,
      rejectionReason,
    });
    await revalidateLeadPaths(leadId, lead.searchRunId);
  }, "Could not update review status. Try again.");
}

export async function updateReviewStatusAction(
  formData: FormData,
): Promise<ActionResult> {
  const leadIdRaw = formData.get("leadId");
  const leadId =
    typeof leadIdRaw === "string"
      ? Number.parseInt(leadIdRaw, 10)
      : Number.NaN;
  if (Number.isNaN(leadId)) {
    return actionFailure("Invalid lead.");
  }

  const reviewStatus = String(formData.get("reviewStatus") ?? "") as ReviewStatus;
  const rejectionReason =
    String(formData.get("rejectionReason") ?? "").trim() || undefined;
  return updateReviewStatus(leadId, reviewStatus, rejectionReason);
}

export async function updateOutcome(
  leadId: number,
  outcome: Outcome,
): Promise<ActionResult> {
  if (!outcomes.includes(outcome)) {
    return actionFailure("Invalid outcome.");
  }

  const db = getDb();
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) {
    return actionFailure("Lead not found.");
  }

  return runServerAction(async () => {
    await applyOutcomeChange(db, leadId, outcome);
    await revalidateLeadPaths(leadId, lead.searchRunId);
  }, "Could not update outcome. Try again.");
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

  if (contactEmail && !isValidEmail(contactEmail)) {
    return { error: "Enter a valid contact email address." };
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
