import Link from "next/link";
import { desc } from "drizzle-orm";
import { ReadyTable } from "@/components/ready-table";
import { getDb } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { getContactAvailability, isReadyLead } from "@/lib/crm-utils";
import { getLatestAuditsForLeads } from "@/lib/services/audit-utils";

export default async function ReadyPage() {
  const db = getDb();
  const allLeads = await db.query.leads.findMany({
    orderBy: [desc(leads.fitScore)],
  });

  const auditMap = await getLatestAuditsForLeads(
    db,
    allLeads.map((l) => l.id),
  );

  const readyLeads = allLeads
    .filter((lead) => {
      const audit = auditMap.get(lead.id) ?? null;
      return isReadyLead(lead, getContactAvailability(lead, audit));
    })
    .map((lead) => ({
      ...lead,
      latestAudit: auditMap.get(lead.id) ?? null,
    }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/pipeline" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Pipeline
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Ready to Contact</h1>
        <p className="text-sm text-zinc-400">
          Approved venues with contact info and fit score ≥ 60 — not yet contacted.
        </p>
      </div>
      <p className="text-xs text-zinc-500">{readyLeads.length} leads</p>
      <ReadyTable leads={readyLeads} />
    </div>
  );
}
