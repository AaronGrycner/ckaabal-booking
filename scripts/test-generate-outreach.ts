import { readFileSync } from "fs";
import { resolve } from "path";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../src/lib/db";
import { websiteAudits } from "../src/lib/db/schema";
import { getLeadActivities } from "../src/lib/services/crm";
import {
  generateOutreachEmail,
  getOutreachModelConfig,
} from "../src/lib/services/outreach-email-generate";

function loadEnvLocal() {
  const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    process.env[trimmed.slice(0, eqIndex)] = trimmed.slice(eqIndex + 1);
  }
}

async function main() {
  loadEnvLocal();
  const leadId = Number(process.argv[2] ?? 72);
  const db = getDb();
  const lead = await db.query.leads.findFirst({
    where: (l, { eq: eqFn }) => eqFn(l.id, leadId),
  });
  if (!lead) {
    console.error("Lead not found:", leadId);
    process.exit(1);
  }

  const audits = await db.query.websiteAudits.findMany({
    where: eq(websiteAudits.leadId, leadId),
    orderBy: [desc(websiteAudits.createdAt)],
    limit: 1,
  });
  const activities = await getLeadActivities(db, leadId);
  const config = getOutreachModelConfig();

  console.log("Model config:", config);
  console.log("Lead:", lead.businessName, lead.contactEmail);

  try {
    const result = await generateOutreachEmail(lead, audits[0] ?? null, activities);
    console.log("PASS");
    console.log("Subject:", result.subject);
    console.log("Body preview:", result.body.slice(0, 120), "...");
    console.log("Model:", result.model);
    console.log("Polished:", result.polished);
    console.log("Rewrite attempts:", result.rewriteAttempts);
    console.log("Selected issue:", result.selectedIssue);
    if (result.warnings.length) console.log("Warnings:", result.warnings);
  } catch (error) {
    console.error("FAIL:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

void main();
