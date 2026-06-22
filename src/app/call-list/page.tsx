import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { CallListTable } from "@/components/call-list-table";
import { getDb } from "@/lib/db";
import { leads } from "@/lib/db/schema";

export default async function CallListPage() {
  const db = getDb();
  const callListLeads = await db.query.leads.findMany({
    where: eq(leads.onCallList, true),
    orderBy: [desc(leads.callListAddedAt)],
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/pipeline" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Pipeline
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Call list</h1>
        <p className="text-sm text-zinc-400">
          Leads queued for phone outreach — phone numbers, business hours, and
          your notes at a glance. Today&apos;s hours are highlighted.
        </p>
      </div>
      <p className="text-xs text-zinc-500">{callListLeads.length} leads</p>
      <CallListTable leads={callListLeads} />
    </div>
  );
}
