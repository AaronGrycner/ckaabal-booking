import { defineConfig } from "drizzle-kit";

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
