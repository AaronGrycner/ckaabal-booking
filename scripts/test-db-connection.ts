import { readFileSync } from "fs";
import { resolve } from "path";
import { count } from "drizzle-orm";
import { getDb, getDatabaseMode } from "../src/lib/db";
import { leads } from "../src/lib/db/schema";

function loadEnvFile(filename: string) {
  try {
    const content = readFileSync(resolve(process.cwd(), filename), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (process.env[key]) continue;
      process.env[key] = trimmed.slice(eq + 1).trim();
    }
  } catch {
    // optional env file
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

async function main() {
  console.log("Database mode:", getDatabaseMode());
  const db = getDb();
  const rows = await db.select({ total: count() }).from(leads);
  console.log("Lead count:", rows[0]?.total ?? 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
