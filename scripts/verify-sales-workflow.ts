/**
 * Verification script for sales workflow layer.
 * Run: npx tsx scripts/verify-sales-workflow.ts
 */
import { eq } from "drizzle-orm";
import { getDb } from "../src/lib/db";
import { leads, leadActivities } from "../src/lib/db/schema";
import {
  getContactAvailability,
  getLastMessageSent,
  isFollowUpDueLead,
  isReadyLead,
} from "../src/lib/crm-utils";
import {
  applyOutcomeChange,
  applyReviewChange,
  getLeadActivities,
  logContact,
} from "../src/lib/services/crm";
import { buildDedupeKey } from "../src/lib/services/dedupe";

const db = getDb();
let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean) {
  if (condition) {
    console.log(`✓ ${name}`);
    passed++;
  } else {
    console.error(`✗ ${name}`);
    failed++;
  }
}

async function cleanupTestLeads() {
  const testLeads = await db.query.leads.findMany();
  for (const lead of testLeads) {
    if (lead.businessName.startsWith("__TEST__")) {
      await db.delete(leads).where(eq(leads.id, lead.id));
    }
  }
}

async function main() {
  await cleanupTestLeads();

  // 1. New leads start unreviewed
  const dedupeKey = buildDedupeKey({
    businessName: "__TEST__ Sales Workflow",
    phone: "5559990001",
  });
  const [testLead] = await db
    .insert(leads)
    .values({
      businessName: "__TEST__ Sales Workflow",
      phone: "5559990001",
      contactEmail: "test@example.com",
      sourceQuery: "Manual test",
      sourceType: "manual",
      fitScore: 75,
      dedupeKey,
    })
    .returning();
  assert("1. New lead starts unreviewed", testLead.reviewStatus === "unreviewed");

  const availability = getContactAvailability(testLead, null);

  // 2. Approved + contact + fit >= 60 → ready
  await applyReviewChange(db, testLead.id, {
    reviewStatus: "approved_for_outreach",
  });
  const approved = await db.query.leads.findFirst({
    where: eq(leads.id, testLead.id),
  });
  assert(
    "2. Approved lead appears in ready queue",
    approved != null && isReadyLead(approved, availability),
  );

  // 3. Rejected → not ready
  await applyReviewChange(db, testLead.id, {
    reviewStatus: "rejected",
    rejectionReason: "Test reject",
  });
  const rejected = await db.query.leads.findFirst({
    where: eq(leads.id, testLead.id),
  });
  assert(
    "3. Rejected lead not in ready queue",
    rejected != null && !isReadyLead(rejected, availability),
  );

  // Re-approve for contact tests
  await applyReviewChange(db, testLead.id, {
    reviewStatus: "approved_for_outreach",
  });

  // 4. Log contact → not ready
  await logContact(db, testLead.id, {
    method: "email",
    messageSent: "Hey — I came across __TEST__ Sales Workflow...",
    followUpDays: 0,
  });
  const contacted = await db.query.leads.findFirst({
    where: eq(leads.id, testLead.id),
  });
  assert(
    "4. Contacted lead removed from ready",
    contacted != null && !isReadyLead(contacted, availability),
  );

  const firstContactedAt = contacted!.firstContactedAt;

  // 5. Follow-up due
  await logContact(db, testLead.id, {
    method: "email",
    followUpDays: -1, // will set follow up in past? followUpDays must be > 0
  });

  // Set followUpDueAt in past manually
  const past = new Date();
  past.setDate(past.getDate() - 1);
  await db
    .update(leads)
    .set({ followUpDueAt: past, status: "follow_up_due" })
    .where(eq(leads.id, testLead.id));

  const followUpLead = await db.query.leads.findFirst({
    where: eq(leads.id, testLead.id),
  });
  assert(
    "5. Follow-up due lead detected",
    followUpLead != null && isFollowUpDueLead(followUpLead),
  );

  // 6. firstContactedAt unchanged, lastContactedAt updates
  await logContact(db, testLead.id, {
    method: "phone",
    note: "Second contact",
  });
  const afterSecond = await db.query.leads.findFirst({
    where: eq(leads.id, testLead.id),
  });
  assert(
    "6a. firstContactedAt unchanged after follow-up",
    afterSecond!.firstContactedAt!.getTime() === firstContactedAt!.getTime(),
  );
  assert(
    "6b. lastContactedAt updated",
    afterSecond!.lastContactedAt!.getTime() > firstContactedAt!.getTime(),
  );

  // 7-8. messageSent in activity metadata
  const activities = await getLeadActivities(db, testLead.id);
  const message = getLastMessageSent(activities);
  assert(
    "7. messageSent saved in activity",
    message?.includes("__TEST__ Sales Workflow") ?? false,
  );

  // 9. Outcome changes status
  await applyOutcomeChange(db, testLead.id, "positive_reply");
  const replied = await db.query.leads.findFirst({
    where: eq(leads.id, testLead.id),
  });
  assert("9. positive_reply sets status replied", replied!.status === "replied");

  await applyOutcomeChange(db, testLead.id, "meeting_booked");
  const meeting = await db.query.leads.findFirst({
    where: eq(leads.id, testLead.id),
  });
  assert(
    "9b. meeting_booked sets meeting_scheduled",
    meeting!.status === "meeting_scheduled",
  );

  // 10. Manual lead in pipeline (exists with sourceType manual)
  assert("10. Manual lead exists in DB", testLead.sourceType === "manual");

  // 11. Analytics counts would include this lead - just verify fields exist
  assert("11. Outcome field set", meeting!.outcome === "meeting_booked");

  // 12. CSV columns - verify lead has export fields
  assert("12. reviewStatus on lead", meeting!.reviewStatus === "approved_for_outreach");
  assert("12b. sourceType on lead", meeting!.sourceType === "manual");

  const outcomeActivity = await db.query.leadActivities.findMany({
    where: eq(leadActivities.leadId, testLead.id),
  });
  assert(
    "8. Outcome change creates activity",
    outcomeActivity.some((a) => a.activityType === "outcome_changed"),
  );

  await cleanupTestLeads();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
