"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import {
  addSignatureAttachment,
  deleteSignatureAttachment,
  saveSignatureSettings,
} from "@/lib/services/outreach-signature";

export type SignatureSettingsActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
};

function revalidateSignaturePaths() {
  revalidatePath("/settings/signature");
  revalidatePath("/pipeline");
  revalidatePath("/leads");
}

export async function saveSignatureSettingsAction(
  _prev: SignatureSettingsActionState,
  formData: FormData,
): Promise<SignatureSettingsActionState> {
  const bodyText = String(formData.get("bodyText") ?? "");
  const attachFilesOnSend = formData.get("attachFilesOnSend") === "on";

  try {
    const db = getDb();
    await saveSignatureSettings(db, { bodyText, attachFilesOnSend });
    revalidateSignaturePaths();
    return { ok: true, message: "Signature saved." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to save signature.",
    };
  }
}

export async function uploadSignatureAttachmentAction(
  _prev: SignatureSettingsActionState,
  formData: FormData,
): Promise<SignatureSettingsActionState> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Choose a file to upload." };
  }

  try {
    const db = getDb();
    await addSignatureAttachment(db, file);
    revalidateSignaturePaths();
    return { ok: true, message: `Uploaded ${file.name}.` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to upload file.",
    };
  }
}

export async function deleteSignatureAttachmentAction(
  attachmentId: number,
): Promise<SignatureSettingsActionState> {
  try {
    const db = getDb();
    await deleteSignatureAttachment(db, attachmentId);
    revalidateSignaturePaths();
    return { ok: true, message: "Attachment removed." };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Failed to delete attachment.",
    };
  }
}
