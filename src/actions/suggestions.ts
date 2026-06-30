"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { softwareSuggestions } from "@/lib/db/schema";
import { toUserFacingError } from "@/lib/action-result";

export type SuggestionActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
};

export async function createSuggestionAction(
  _prev: SuggestionActionState,
  formData: FormData,
): Promise<SuggestionActionState> {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) {
    return { ok: false, error: "Enter a suggestion before saving." };
  }
  if (body.length > 5000) {
    return { ok: false, error: "Suggestion is too long (max 5000 characters)." };
  }

  try {
    const db = getDb();
    await db.insert(softwareSuggestions).values({ body });
    revalidatePath("/suggestions");
    return { ok: true, message: "Suggestion added." };
  } catch (error) {
    return {
      ok: false,
      error: toUserFacingError(error, "Failed to save suggestion."),
    };
  }
}

export async function deleteSuggestionAction(
  id: number,
): Promise<SuggestionActionState> {
  if (!Number.isInteger(id) || id < 1) {
    return { ok: false, error: "Invalid suggestion." };
  }

  try {
    const db = getDb();
    await db.delete(softwareSuggestions).where(eq(softwareSuggestions.id, id));
    revalidatePath("/suggestions");
    return { ok: true, message: "Suggestion deleted." };
  } catch (error) {
    return {
      ok: false,
      error: toUserFacingError(error, "Failed to delete suggestion."),
    };
  }
}

export async function listSuggestions() {
  const db = getDb();
  return db.query.softwareSuggestions.findMany({
    orderBy: [desc(softwareSuggestions.createdAt)],
  });
}
