import { inArray } from "drizzle-orm";
import type { getDb } from "@/lib/db";
import { websiteAudits, type WebsiteAudit } from "@/lib/db/schema";
import { parseContactsJson } from "@/lib/parse-contacts-json";

export { parseContactsJson };

type Db = ReturnType<typeof getDb>;

export async function getLatestAuditsForLeads(
  db: Db,
  leadIds: number[],
): Promise<Map<number, WebsiteAudit>> {
  const map = new Map<number, WebsiteAudit>();
  if (!leadIds.length) return map;

  const audits = await db.query.websiteAudits.findMany({
    where: inArray(websiteAudits.leadId, leadIds),
  });

  for (const audit of audits) {
    const existing = map.get(audit.leadId);
    if (!existing || audit.createdAt > existing.createdAt) {
      map.set(audit.leadId, audit);
    }
  }

  return map;
}
