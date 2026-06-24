import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { defineConfig } from "drizzle-kit";

function loadEnvFile(filename: string) {
  const path = join(process.cwd(), filename);
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");
loadEnvFile("env.local");

function getTursoCredentials() {
  const url =
    process.env.TURSO_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (!url) return null;
  if (
    url.startsWith("libsql:") ||
    url.startsWith("https:") ||
    url.startsWith("http:")
  ) {
    return { url, authToken: authToken ?? "" };
  }
  return null;
}

const turso = getTursoCredentials();

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: turso ? "turso" : "sqlite",
  dbCredentials: turso
    ? turso
    : {
        url: process.env.DATABASE_URL ?? "file:./data/booking-crm.db",
      },
});
