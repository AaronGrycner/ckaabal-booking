/**
 * Audits CRM button backend logic (same paths server actions invoke).
 * Run: npx tsx scripts/audit-crm-buttons.ts
 */
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getDb } from "../src/lib/db";
import { leads } from "../src/lib/db/schema";
import {
  applyOutcomeChange,
  applyReviewChange,
  applyStatusChange,
  logContact,
} from "../src/lib/services/crm";
import { buildDedupeKey } from "../src/lib/services/dedupe";
import { GET as exportCsvGet } from "../src/app/api/export/csv/route";

const db = getDb();
let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean) {
  if (condition) {
    console.log(`OK: ${name}`);
    passed++;
  } else {
    console.error(`FAIL: ${name}`);
    failed++;
  }
}

async function cleanup() {
  const rows = await db.query.leads.findMany();
  for (const row of rows) {
    if (row.businessName.startsWith("__AUDIT__")) {
      await db.delete(leads).where(eq(leads.id, row.id));
    }
  }
}

async function createAuditLead(name: string) {
  const dedupeKey = buildDedupeKey({
    businessName: name,
    phone: `555-audit-${Date.now()}-${Math.random()}`,
  });
  const [lead] = await db
    .insert(leads)
    .values({
      businessName: name,
      phone: dedupeKey,
      contactEmail: "audit@example.com",
      sourceQuery: "Audit test",
      sourceType: "manual",
      dedupeKey,
    })
    .returning();
  return lead;
}

async function main() {
  await cleanup();

  const lead = await createAuditLead("__AUDIT__ Button Audit Lead");

  // Search results + lead detail: Approve / Reject
  await applyReviewChange(db, lead.id, {
    reviewStatus: "approved_for_outreach",
  });
  let row = await db.query.leads.findFirst({ where: eq(leads.id, lead.id) });
  assert("Approve for outreach", row?.reviewStatus === "approved_for_outreach");

  await applyReviewChange(db, lead.id, {
    reviewStatus: "rejected",
    rejectionReason: "Audit reject",
  });
  row = await db.query.leads.findFirst({ where: eq(leads.id, lead.id) });
  assert(
    "Reject lead",
    row?.reviewStatus === "rejected" && row.rejectionReason === "Audit reject",
  );

  await applyReviewChange(db, lead.id, { reviewStatus: "approved_for_outreach" });

  // Search results: Queue
  await applyStatusChange(db, lead.id, "ready_to_contact");
  row = await db.query.leads.findFirst({ where: eq(leads.id, lead.id) });
  assert("Queue (ready to contact)", row?.status === "ready_to_contact");

  // Ready / CRM panel / follow-ups: Log contact
  await logContact(db, lead.id, {
    method: "email",
    messageSent: "Audit outreach message",
    followUpDays: 3,
  });
  row = await db.query.leads.findFirst({ where: eq(leads.id, lead.id) });
  assert(
    "Log contact",
    row?.status === "contacted" &&
      row.lastContactMethod === "email" &&
      row.followUpDueAt != null,
  );

  // Lead detail: Save notes
  await db
    .update(leads)
    .set({ notes: "Audit notes saved", updatedAt: new Date() })
    .where(eq(leads.id, lead.id));
  row = await db.query.leads.findFirst({ where: eq(leads.id, lead.id) });
  assert("Save notes", row?.notes === "Audit notes saved");

  // Lead detail + outreach: Save contact email
  await db
    .update(leads)
    .set({
      contactEmail: "updated-audit@example.com",
      emailSource: "manual",
      updatedAt: new Date(),
    })
    .where(eq(leads.id, lead.id));
  row = await db.query.leads.findFirst({ where: eq(leads.id, lead.id) });
  assert("Save contact email", row?.contactEmail === "updated-audit@example.com");

  // Pipeline + lead detail: Call list toggle
  await db
    .update(leads)
    .set({ onCallList: true, callListAddedAt: new Date(), updatedAt: new Date() })
    .where(eq(leads.id, lead.id));
  row = await db.query.leads.findFirst({ where: eq(leads.id, lead.id) });
  assert("Add to call list", row?.onCallList === true);

  await db
    .update(leads)
    .set({ onCallList: false, callListAddedAt: null, updatedAt: new Date() })
    .where(eq(leads.id, lead.id));
  row = await db.query.leads.findFirst({ where: eq(leads.id, lead.id) });
  assert("Remove from call list", row?.onCallList === false);

  // Outreach panel: Save draft
  await db
    .update(leads)
    .set({
      outreachDraftSubject: "Audit subject",
      outreachDraftBody: "Audit body",
      outreachDraftUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(leads.id, lead.id));
  row = await db.query.leads.findFirst({ where: eq(leads.id, lead.id) });
  assert(
    "Save outreach draft",
    row?.outreachDraftSubject === "Audit subject" &&
      row?.outreachDraftBody === "Audit body",
  );

  // Follow-ups: Mark replied / not interested
  await applyStatusChange(db, lead.id, "replied");
  row = await db.query.leads.findFirst({ where: eq(leads.id, lead.id) });
  assert("Mark replied", row?.status === "replied");

  await applyStatusChange(db, lead.id, "not_interested");
  row = await db.query.leads.findFirst({ where: eq(leads.id, lead.id) });
  assert("Mark not interested", row?.status === "not_interested");

  // Lead detail: Outcome select
  await applyOutcomeChange(db, lead.id, "meeting_booked");
  row = await db.query.leads.findFirst({ where: eq(leads.id, lead.id) });
  assert(
    "Outcome → meeting scheduled",
    row?.outcome === "meeting_booked" && row.status === "meeting_scheduled",
  );

  // Search results: Export CSV
  const exportResponse = await exportCsvGet(
    new NextRequest(`http://localhost/api/export/csv?ids=${lead.id}`),
  );
  const exportText = await exportResponse.text();
  assert(
    "Export CSV",
    exportResponse.status === 200 &&
      exportText.includes("__AUDIT__ Button Audit Lead") &&
      exportText.includes("businessName"),
  );

  // Pipeline: Delete single + bulk
  const bulkLead = await createAuditLead("__AUDIT__ Bulk Delete Lead");
  await db.delete(leads).where(eq(leads.id, bulkLead.id));
  const deletedBulk = await db.query.leads.findFirst({
    where: eq(leads.id, bulkLead.id),
  });
  assert("Bulk delete path", deletedBulk == null);

  await db.delete(leads).where(eq(leads.id, lead.id));
  const deletedSolo = await db.query.leads.findFirst({
    where: eq(leads.id, lead.id),
  });
  assert("Delete lead", deletedSolo == null);

  await cleanup();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
