import fs from "fs";
import path from "path";

export type DatabaseConfig = {
  url: string;
  authToken?: string;
  mode: "turso" | "file";
};

export function getDatabaseConfig(): DatabaseConfig {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (tursoUrl) {
    return {
      url: tursoUrl,
      authToken: authToken || undefined,
      mode: "turso",
    };
  }

  const databaseUrl =
    process.env.DATABASE_URL?.trim() ?? "file:./data/booking-crm.db";

  if (
    databaseUrl.startsWith("libsql:") ||
    databaseUrl.startsWith("https:") ||
    databaseUrl.startsWith("http:")
  ) {
    return {
      url: databaseUrl,
      authToken: authToken || undefined,
      mode: "turso",
    };
  }

  if (process.env.VERCEL) {
    throw new Error(
      "TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set on Vercel.",
    );
  }

  const relative = databaseUrl.replace(/^file:/, "");
  const dbPath = path.isAbsolute(relative)
    ? relative
    : path.join(/* turbopackIgnore: true */ process.cwd(), relative);

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  return {
    url: `file:${dbPath}`,
    mode: "file",
  };
}
