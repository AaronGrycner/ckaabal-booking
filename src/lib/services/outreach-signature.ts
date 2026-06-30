import { eq } from "drizzle-orm";
import type { getDb } from "@/lib/db";
import {
  outreachEmailAttachments,
  outreachSignatureSettings,
  type OutreachEmailAttachment,
  type OutreachSignatureSettings,
} from "@/lib/db/schema";
import { UserFacingError } from "@/lib/action-result";

type Db = ReturnType<typeof getDb>;

const SETTINGS_ID = 1;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 10;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "text/plain",
]);

export type SignatureSettingsView = {
  settings: OutreachSignatureSettings;
  attachments: Array<
    Pick<OutreachEmailAttachment, "id" | "filename" | "mimeType" | "sizeBytes" | "createdAt">
  >;
  effectiveSignaturePreview: string;
};

function buildSignatureFromEnv() {
  const custom = process.env.OUTREACH_SIGNATURE?.trim();
  if (custom) {
    return custom.replace(/\\n/g, "\n");
  }

  const bandName =
    process.env.OUTREACH_BAND_NAME?.trim() ||
    process.env.OUTREACH_COMPANY_NAME?.trim() ||
    "ckaabal";
  const name = process.env.OUTREACH_SENDER_NAME?.trim() || bandName;
  const title = process.env.OUTREACH_SENDER_TITLE?.trim();
  const tagline = process.env.OUTREACH_TAGLINE?.trim();
  const website = (
    process.env.OUTREACH_WEBSITE?.trim() ||
    process.env.PUBLIC_SITE_URL?.trim() ||
    "https://ckaabal.com"
  ).replace(/^https?:\/\//, "");
  const email = process.env.OUTREACH_EMAIL?.trim();

  const lines = ["--"];
  if (name) lines.push(name);
  if (title) lines.push(title);
  if (tagline) lines.push(tagline);
  if (website || email) {
    lines.push("");
    if (website) lines.push(website);
    if (email) lines.push(email);
  }

  return lines.join("\n");
}

export async function getOrCreateSignatureSettings(db: Db) {
  const existing = await db.query.outreachSignatureSettings.findFirst({
    where: eq(outreachSignatureSettings.id, SETTINGS_ID),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(outreachSignatureSettings)
    .values({ id: SETTINGS_ID, bodyText: "" })
    .returning();

  return created;
}

export async function resolveOutreachSignatureText(db: Db) {
  const settings = await getOrCreateSignatureSettings(db);
  const custom = settings.bodyText.trim();
  if (custom) return custom;
  return buildSignatureFromEnv();
}

export async function getSignatureSettingsView(db: Db): Promise<SignatureSettingsView> {
  const settings = await getOrCreateSignatureSettings(db);
  const attachments = await db.query.outreachEmailAttachments.findMany({
    orderBy: (table, { desc }) => [desc(table.createdAt)],
    columns: {
      id: true,
      filename: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });

  const effectiveSignaturePreview = settings.bodyText.trim()
    ? settings.bodyText
    : buildSignatureFromEnv();

  return { settings, attachments, effectiveSignaturePreview };
}

export async function saveSignatureSettings(
  db: Db,
  input: { bodyText: string; attachFilesOnSend: boolean },
) {
  await getOrCreateSignatureSettings(db);
  const [updated] = await db
    .update(outreachSignatureSettings)
    .set({
      bodyText: input.bodyText,
      attachFilesOnSend: input.attachFilesOnSend,
      updatedAt: new Date(),
    })
    .where(eq(outreachSignatureSettings.id, SETTINGS_ID))
    .returning();

  return updated;
}

export function validateAttachmentFile(file: File) {
  if (!file.size) {
    return "File is empty.";
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `File is too large (max ${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB).`;
  }
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return `File type not allowed: ${file.type}`;
  }
  return null;
}

export async function addSignatureAttachment(db: Db, file: File) {
  const validationError = validateAttachmentFile(file);
  if (validationError) {
    throw new UserFacingError(validationError);
  }

  const count = await db.query.outreachEmailAttachments.findMany({
    columns: { id: true },
  });
  if (count.length >= MAX_ATTACHMENTS) {
    throw new UserFacingError(`Maximum ${MAX_ATTACHMENTS} attachments allowed.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const [attachment] = await db
    .insert(outreachEmailAttachments)
    .values({
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      content: buffer,
    })
    .returning({
      id: outreachEmailAttachments.id,
      filename: outreachEmailAttachments.filename,
      mimeType: outreachEmailAttachments.mimeType,
      sizeBytes: outreachEmailAttachments.sizeBytes,
      createdAt: outreachEmailAttachments.createdAt,
    });

  return attachment;
}

export async function deleteSignatureAttachment(db: Db, attachmentId: number) {
  await db
    .delete(outreachEmailAttachments)
    .where(eq(outreachEmailAttachments.id, attachmentId));
}

export async function getSendableAttachments(db: Db) {
  const settings = await getOrCreateSignatureSettings(db);
  if (!settings.attachFilesOnSend) return [];

  const rows = await db.query.outreachEmailAttachments.findMany({
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  });

  return rows.map((row) => ({
    filename: row.filename,
    content: row.content,
    contentType: row.mimeType,
  }));
}

export function formatAttachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
