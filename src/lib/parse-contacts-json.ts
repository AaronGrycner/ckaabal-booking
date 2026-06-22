import type { WebsiteAudit } from "@/lib/db/schema";
import type { ContactsData } from "@/lib/services/contact-extract";

export function parseContactsJson(
  audit: WebsiteAudit | null | undefined,
): ContactsData | null {
  if (!audit?.contactsJson) return null;
  try {
    return JSON.parse(audit.contactsJson) as ContactsData;
  } catch {
    return null;
  }
}
