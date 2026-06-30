"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { leads, websiteAudits } from "@/lib/db/schema";
import { getGmailConnectionStatus, sendGmailMessage } from "@/lib/services/gmail";
import {
  logContact,
  getLeadActivities,
  logOutreachEmailGenerated,
  logOutreachEmailPremiumPolished,
} from "@/lib/services/crm";
import {
  generateOutreachEmail,
  isPremiumPolishEnabled,
  OutreachGenerationError,
  premiumPolishOutreachEmail,
  toOutreachGenerationActivityMetadata,
  toOutreachPremiumPolishActivityMetadata,
  toOutreachQualityReview,
  type OutreachQualityReview,
} from "@/lib/services/outreach-email-generate";
import { isFollowUpDueLead } from "@/lib/crm-utils";
import {
  getOrCreateSignatureTrackedLink,
  prepareOutreachEmailBodyWithTrackedLink,
} from "@/lib/services/outreach-tracking";
import { getSendableAttachments } from "@/lib/services/outreach-signature";
import { toUserFacingError } from "@/lib/action-result";

export type OutreachActionResult =
  | {
      ok: true;
      subject?: string;
      body?: string;
      message?: string;
      quality?: OutreachQualityReview;
    }
  | { ok: false; error: string };

async function revalidateLeadPaths(leadId: number, searchRunId?: number | null) {
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/pipeline");
  revalidatePath("/ready");
  revalidatePath("/follow-ups");
  revalidatePath("/analytics");
  revalidatePath("/");
  if (searchRunId != null) {
    revalidatePath(`/search/${searchRunId}`);
  }
}

async function getLeadWithAudit(leadId: number) {
  const db = getDb();
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) return null;

  const audits = await db.query.websiteAudits.findMany({
    where: eq(websiteAudits.leadId, leadId),
    orderBy: [desc(websiteAudits.createdAt)],
    limit: 1,
  });

  const activities = await getLeadActivities(db, leadId);
  return { lead, audit: audits[0] ?? null, activities };
}

async function saveOutreachDraft(
  leadId: number,
  subject: string,
  body: string,
) {
  const db = getDb();
  await db
    .update(leads)
    .set({
      outreachDraftSubject: subject,
      outreachDraftBody: body,
      outreachDraftUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(leads.id, leadId));
}

function getSendCooldownMs() {
  const minutes = Number.parseInt(
    process.env.OUTREACH_SEND_COOLDOWN_MINUTES ?? "2",
    10,
  );
  return (Number.isNaN(minutes) ? 2 : minutes) * 60_000;
}

function shouldClearFollowUp(lead: {
  status: string;
  followUpDueAt: Date | null;
}) {
  return lead.status === "follow_up_due" || Boolean(lead.followUpDueAt);
}

export async function saveOutreachDraftAction(
  leadId: number,
  subject: string,
  body: string,
): Promise<OutreachActionResult> {
  const data = await getLeadWithAudit(leadId);
  if (!data) return { ok: false, error: "Lead not found." };

  const trimmedSubject = subject.trim();
  const trimmedBody = body.trim();
  if (!trimmedSubject || !trimmedBody) {
    return { ok: false, error: "Subject and body are required to save a draft." };
  }

  try {
    await saveOutreachDraft(leadId, trimmedSubject, trimmedBody);
    await revalidateLeadPaths(leadId, data.lead.searchRunId);
    return { ok: true, message: "Draft saved." };
  } catch (error) {
    return {
      ok: false,
      error: toUserFacingError(error, "Failed to save draft."),
    };
  }
}

export async function generateOutreachEmailAction(
  leadId: number,
  optionalInstruction?: string,
): Promise<OutreachActionResult> {
  const data = await getLeadWithAudit(leadId);
  if (!data) return { ok: false, error: "Lead not found." };

  try {
    const result = await generateOutreachEmail(
      data.lead,
      data.audit,
      data.activities,
      { optionalUserInstruction: optionalInstruction },
    );
    await saveOutreachDraft(leadId, result.subject, result.body);

    const db = getDb();
    await logOutreachEmailGenerated(
      db,
      leadId,
      toOutreachGenerationActivityMetadata(result),
    );

    await revalidateLeadPaths(leadId, data.lead.searchRunId);
    return {
      ok: true,
      subject: result.subject,
      body: result.body,
      quality: toOutreachQualityReview(result),
    };
  } catch (error) {
    return {
      ok: false,
      error: toUserFacingError(
        error,
        "Failed to generate email.",
        OutreachGenerationError,
      ),
    };
  }
}

export async function generateFollowUpOutreachEmailAction(
  leadId: number,
  optionalInstruction?: string,
): Promise<OutreachActionResult> {
  const data = await getLeadWithAudit(leadId);
  if (!data) return { ok: false, error: "Lead not found." };

  if (!isFollowUpDueLead(data.lead)) {
    return {
      ok: false,
      error: "Follow-up is not due yet for this lead.",
    };
  }

  try {
    const result = await generateOutreachEmail(
      data.lead,
      data.audit,
      data.activities,
      {
        mode: "follow_up",
        optionalUserInstruction: optionalInstruction,
      },
    );
    await saveOutreachDraft(leadId, result.subject, result.body);

    const db = getDb();
    await logOutreachEmailGenerated(
      db,
      leadId,
      toOutreachGenerationActivityMetadata(result, "follow_up"),
    );

    await revalidateLeadPaths(leadId, data.lead.searchRunId);
    return {
      ok: true,
      subject: result.subject,
      body: result.body,
      quality: toOutreachQualityReview(result),
      message: "Follow-up email generated.",
    };
  } catch (error) {
    return {
      ok: false,
      error: toUserFacingError(
        error,
        "Failed to generate follow-up email.",
        OutreachGenerationError,
      ),
    };
  }
}

export async function premiumPolishOutreachEmailAction(
  leadId: number,
  optionalInstruction?: string,
): Promise<OutreachActionResult> {
  const data = await getLeadWithAudit(leadId);
  if (!data) return { ok: false, error: "Lead not found." };

  if (!isPremiumPolishEnabled()) {
    return { ok: false, error: "Premium polish is disabled." };
  }

  const currentSubject = data.lead.outreachDraftSubject?.trim() ?? "";
  const currentBody = data.lead.outreachDraftBody?.trim() ?? "";
  if (!currentSubject || !currentBody) {
    return {
      ok: false,
      error: "Generate a draft first before using premium polish.",
    };
  }

  try {
    const instruction = optionalInstruction?.trim();
    const result = await premiumPolishOutreachEmail(
      data.lead,
      data.audit,
      data.activities,
      { subject: currentSubject, body: currentBody },
      { optionalUserInstruction: instruction },
    );
    await saveOutreachDraft(leadId, result.subject, result.body);

    const db = getDb();
    await logOutreachEmailPremiumPolished(
      db,
      leadId,
      toOutreachPremiumPolishActivityMetadata(result, instruction),
    );

    await revalidateLeadPaths(leadId, data.lead.searchRunId);
    return {
      ok: true,
      subject: result.subject,
      body: result.body,
      quality: toOutreachQualityReview(result),
      message: "Draft polished with premium model.",
    };
  } catch (error) {
    return {
      ok: false,
      error: toUserFacingError(
        error,
        "Failed to polish email.",
        OutreachGenerationError,
      ),
    };
  }
}

export async function sendOutreachEmailAction(
  leadId: number,
  subject: string,
  body: string,
  followUpDaysRaw?: string,
  toEmailRaw?: string,
): Promise<OutreachActionResult> {
  const data = await getLeadWithAudit(leadId);
  if (!data) return { ok: false, error: "Lead not found." };

  const { lead } = data;
  const trimmedSubject = subject.trim();
  const trimmedBody = body.trim();

  if (!trimmedSubject || !trimmedBody) {
    return { ok: false, error: "Subject and body are required to send." };
  }

  const toEmail = (toEmailRaw?.trim() || lead.contactEmail?.trim() || "");
  if (!toEmail) {
    return {
      ok: false,
      error: "Add a contact email before sending.",
    };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
    return { ok: false, error: "Enter a valid contact email before sending." };
  }

  const db = getDb();
  if (toEmail !== (lead.contactEmail?.trim() ?? "")) {
    await db
      .update(leads)
      .set({
        contactEmail: toEmail,
        emailSource: "manual",
        emailConfidence: null,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId));
  }

  const gmailStatus = await getGmailConnectionStatus();
  if (!gmailStatus.configured) {
    return {
      ok: false,
      error:
        "Gmail is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in your environment.",
    };
  }

  const cooldownMs = getSendCooldownMs();
  if (
    lead.lastContactMethod === "email" &&
    lead.lastContactedAt &&
    Date.now() - lead.lastContactedAt.getTime() < cooldownMs
  ) {
    return {
      ok: false,
      error:
        "An email was just sent to this lead. Wait a few minutes before sending again.",
    };
  }

  const followUpDaysTrimmed = followUpDaysRaw?.trim() ?? "";
  const followUpDays = followUpDaysTrimmed
    ? Number.parseInt(followUpDaysTrimmed, 10)
    : undefined;
  if (
    followUpDaysTrimmed &&
    followUpDaysTrimmed !== "0" &&
    (followUpDays == null || Number.isNaN(followUpDays) || followUpDays < 1)
  ) {
    return { ok: false, error: "Follow-up days must be a positive number." };
  }

  try {
    const trackedLink = await getOrCreateSignatureTrackedLink(db, leadId);
    const bodyToSend = prepareOutreachEmailBodyWithTrackedLink(
      trimmedBody,
      trackedLink,
    );
    const attachments = await getSendableAttachments(db);

    await sendGmailMessage({
      to: toEmail,
      subject: trimmedSubject,
      body: bodyToSend.text,
      html: bodyToSend.html,
      attachments,
    });

    await logContact(db, leadId, {
      method: "email",
      messageSent: `Subject: ${trimmedSubject}\n\n${bodyToSend.text}`,
      followUpDays:
        followUpDaysTrimmed === "0"
          ? 0
          : followUpDays != null && !Number.isNaN(followUpDays)
            ? followUpDays
            : undefined,
      clearFollowUp: shouldClearFollowUp(lead),
    });
  } catch (error) {
    return {
      ok: false,
      error: toUserFacingError(error, "Failed to send email."),
    };
  }

  await revalidateLeadPaths(leadId, lead.searchRunId);
  return { ok: true, message: "Email sent and contact logged." };
}
