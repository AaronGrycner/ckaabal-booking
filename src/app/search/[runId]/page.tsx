import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { AuditPendingPoller } from "@/components/audit-pending-poller";
import { LeadTable } from "@/components/lead-table";
import { getDb } from "@/lib/db";
import { leads, searchRuns, websiteAudits } from "@/lib/db/schema";

export default async function SearchResultsPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId: runIdParam } = await params;
  const runId = Number(runIdParam);
  if (Number.isNaN(runId)) notFound();

  const db = getDb();
  const run = await db.query.searchRuns.findFirst({
    where: eq(searchRuns.id, runId),
  });

  if (!run) notFound();

  const runLeads = await db.query.leads.findMany({
    where: eq(leads.searchRunId, runId),
  });

  const leadsWithAudits = await Promise.all(
    runLeads.map(async (lead) => {
      const audits = await db.query.websiteAudits.findMany({
        where: eq(websiteAudits.leadId, lead.id),
      });
      const latestAudit = audits.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      )[0];
      return { ...lead, latestAudit: latestAudit ?? null };
    }),
  );

  const hasPending = runLeads.some((l) => l.auditStatus === "pending");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← New search
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Search results</h1>
        <p className="text-sm text-zinc-400">
          {run.query} in {run.location} · {run.totalFound} leads found
        </p>
      </div>

      <AuditPendingPoller hasPending={hasPending} />
      <LeadTable leads={leadsWithAudits} runId={runId} />
    </div>
  );
}
