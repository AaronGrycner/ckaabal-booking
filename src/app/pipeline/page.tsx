import Link from "next/link";
import { desc } from "drizzle-orm";
import { PipelineTable } from "@/components/pipeline-table";
import { getDb } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { getLatestAuditsForLeads } from "@/lib/services/audit-utils";

export default async function PipelinePage() {
  const db = getDb();
  const allLeads = await db.query.leads.findMany({
    orderBy: [desc(leads.updatedAt)],
  });

  const auditMap = await getLatestAuditsForLeads(
    db,
    allLeads.map((l) => l.id),
  );

  const leadsWithAudits = allLeads.map((lead) => ({
    ...lead,
    latestAudit: auditMap.get(lead.id) ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Pipeline</h1>
        <p className="text-sm text-zinc-400">
          All leads across searches — filter, track outreach, and remove bad
          entries. Rejected leads are hidden by default.
        </p>
      </div>
      <PipelineTable leads={leadsWithAudits} />
    </div>
  );
}
