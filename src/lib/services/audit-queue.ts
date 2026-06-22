import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { leads, websiteAudits } from "@/lib/db/schema";
import { sleep } from "@/lib/utils";
import { runHtmlAudit } from "./html-audit";
import { runPageSpeedAudit } from "./pagespeed";
import { scoreFromPlacesOnly, scoreFull } from "./scoring";

const activeRuns = new Set<number>();

export async function enqueueAuditsForRun(runId: number) {
  if (activeRuns.has(runId)) return;
  activeRuns.add(runId);

  try {
    const db = getDb();
    const pendingLeads = await db.query.leads.findMany({
      where: eq(leads.searchRunId, runId),
    });

    for (const lead of pendingLeads) {
      if (lead.auditStatus !== "pending" || !lead.websiteUrl) continue;

      await auditLead(lead.id);
      await sleep(1000);
    }
  } finally {
    activeRuns.delete(runId);
  }
}

export async function auditLead(leadId: number) {
  const db = getDb();
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });

  if (!lead || lead.auditStatus !== "pending" || !lead.websiteUrl) return;

  const pageSpeed = await runPageSpeedAudit(lead.websiteUrl);
  const html = await runHtmlAudit(lead.websiteUrl);

  const issues = {
    pageSpeedFailed: pageSpeed.failed ?? false,
    htmlFailed: html.failed ?? false,
    ecommerceHeavy: html.ecommerceHeavy,
    pageSpeedError: pageSpeed.error,
    htmlError: html.error,
    brokenLinks: html.brokenLinks,
    siteHealth: html.siteHealth,
    venueResearch: html.venueResearch,
  };

  await db.insert(websiteAudits).values({
    leadId: lead.id,
    url: lead.websiteUrl,
    httpStatus: html.httpStatus,
    hasHttps: html.hasHttps,
    title: html.title,
    metaDescription: html.metaDescription,
    mobilePerformanceScore: pageSpeed.mobilePerformanceScore,
    seoScore: pageSpeed.seoScore,
    accessibilityScore: pageSpeed.accessibilityScore,
    bestPracticesScore: pageSpeed.bestPracticesScore,
    lcp: pageSpeed.lcp,
    cls: pageSpeed.cls,
    tbt: pageSpeed.tbt,
    hasPhone: html.hasPhone,
    hasContactLink: html.hasContactLink,
    hasServicesContent: html.hasServicesContent,
    hasBookingLink: html.hasBookingLink,
    detectedBuilder: html.detectedBuilder,
    contactsJson: JSON.stringify(html.contacts),
    issuesJson: JSON.stringify(issues),
  });

  const auditRow = await db.query.websiteAudits.findFirst({
    where: eq(websiteAudits.leadId, lead.id),
    orderBy: (a, { desc }) => [desc(a.createdAt)],
  });

  const score = scoreFull(lead, auditRow ?? undefined);
  const auditStatus =
    pageSpeed.failed && html.failed ? "failed" : "complete";

  await db
    .update(leads)
    .set({
      auditStatus,
      contactEmail: html.contacts.bestEmail,
      emailConfidence: html.contacts.emailConfidence,
      emailSource: html.contacts.emailSource,
      instagramUrl: html.contacts.instagramUrl,
      facebookUrl: html.contacts.facebookUrl,
      linkedinUrl: html.contacts.linkedinUrl,
      fitScore: score.fitScore,
      fitLabel: score.fitLabel,
      mainIssue: score.mainIssue,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, lead.id));
}

export async function applyPreliminaryScore(leadId: number) {
  const db = getDb();
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) return;

  const score = scoreFromPlacesOnly(lead);

  await db
    .update(leads)
    .set({
      fitScore: score.fitScore,
      fitLabel: score.fitLabel,
      mainIssue: score.mainIssue,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, leadId));
}
