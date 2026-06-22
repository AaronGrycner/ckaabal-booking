import Link from "next/link";
import { desc } from "drizzle-orm";
import { FollowUpsTable } from "@/components/follow-ups-table";
import { getDb } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { isFollowUpDueLead } from "@/lib/crm-utils";
import { getLeadActivities } from "@/lib/services/crm";

export default async function FollowUpsPage() {
  const db = getDb();
  const allLeads = await db.query.leads.findMany({
    orderBy: [desc(leads.followUpDueAt)],
  });

  const dueLeads = allLeads.filter(isFollowUpDueLead);

  const rows = await Promise.all(
    dueLeads.map(async (lead) => ({
      ...lead,
      activities: await getLeadActivities(db, lead.id),
    })),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/pipeline" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Pipeline
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Follow-ups Due</h1>
        <p className="text-sm text-zinc-400">
          Leads with follow-up dates that have passed.
        </p>
      </div>
      <p className="text-xs text-zinc-500">{rows.length} leads</p>
      <FollowUpsTable leads={rows} />
    </div>
  );
}
