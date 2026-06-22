import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { LeadDetailClient } from "@/components/lead-detail-client";
import { getDb } from "@/lib/db";
import { leads, websiteAudits } from "@/lib/db/schema";
import { getLeadActivities } from "@/lib/services/crm";
import { getGmailConnectionStatus } from "@/lib/services/gmail";
import { isPremiumPolishEnabled } from "@/lib/services/outreach-email-generate";
import {
  buildTrackedLinkUrl,
  getSignatureTrackedLinkForLead,
} from "@/lib/services/outreach-tracking";
import { getDefaultFollowUpDays } from "@/lib/crm-utils";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) notFound();

  const db = getDb();
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, id),
  });

  if (!lead) notFound();

  const audits = await db.query.websiteAudits.findMany({
    where: eq(websiteAudits.leadId, id),
  });
  const audit =
    audits.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ??
    null;

  const activities = await getLeadActivities(db, id);
  const signatureLink = await getSignatureTrackedLinkForLead(db, id);
  const trackedUrl = signatureLink
    ? buildTrackedLinkUrl(signatureLink.token)
    : null;
  const gmailStatus = await getGmailConnectionStatus();
  const premiumPolishEnabled = isPremiumPolishEnabled();
  const defaultFollowUpDays = getDefaultFollowUpDays();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        {lead.searchRunId != null ? (
          <Link
            href={`/search/${lead.searchRunId}`}
            className="text-sm text-zinc-500 hover:text-zinc-300"
          >
            ← Back to results
          </Link>
        ) : (
          <Link
            href="/pipeline"
            className="text-sm text-zinc-500 hover:text-zinc-300"
          >
            ← Pipeline
          </Link>
        )}
        <Link
          href="/pipeline"
          className="text-sm text-zinc-500 hover:text-zinc-300"
        >
          Pipeline
        </Link>
      </div>
      <LeadDetailClient
        key={`${lead.id}-${lead.updatedAt?.getTime() ?? 0}`}
        lead={lead}
        audit={audit}
        activities={activities}
        gmailStatus={gmailStatus}
        premiumPolishEnabled={premiumPolishEnabled}
        defaultFollowUpDays={defaultFollowUpDays}
        signatureLink={signatureLink}
        trackedUrl={trackedUrl}
      />
    </div>
  );
}
