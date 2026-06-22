import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getDatabaseConfig } from "./config";
import * as schema from "./schema";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (dbInstance) return dbInstance;

  const config = getDatabaseConfig();
  const client = createClient(
    config.authToken
      ? { url: config.url, authToken: config.authToken }
      : { url: config.url },
  );

  dbInstance = drizzle(client, { schema });
  return dbInstance;
}

export function getDatabaseMode() {
  return getDatabaseConfig().mode;
}

export { schema };
export { getDatabaseConfig } from "./config";
