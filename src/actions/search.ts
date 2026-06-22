"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { leads, searchRuns } from "@/lib/db/schema";
import {
  applyPreliminaryScore,
  enqueueAuditsForRun,
} from "@/lib/services/audit-queue";
import { buildDedupeKey } from "@/lib/services/dedupe";
import { searchPlaces } from "@/lib/services/places";

export type SearchState = {
  error?: string;
};

export async function runSearch(
  _prev: SearchState,
  formData: FormData,
): Promise<SearchState> {
  const niche = String(formData.get("niche") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const maxResults = Math.min(
    60,
    Math.max(1, Number(formData.get("maxResults") ?? 20)),
  );

  if (!niche || !location) {
    return { error: "Please enter both a venue type and location." };
  }

  try {
    const db = getDb();
    const sourceQuery = `${niche} in ${location}`;
    const places = await searchPlaces(niche, location, maxResults);

    const [run] = await db
      .insert(searchRuns)
      .values({
        query: niche,
        location,
        maxResults,
        totalFound: 0,
      })
      .returning();

    let saved = 0;
    const seenKeys = new Set<string>();

    for (const place of places) {
      const dedupeKey = buildDedupeKey({
        businessName: place.businessName,
        address: place.address,
        phone: place.phone,
        websiteUrl: place.websiteUrl,
      });

      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);

      const auditStatus = place.websiteUrl ? "pending" : "skipped";

      try {
        const [lead] = await db
          .insert(leads)
          .values({
            searchRunId: run.id,
            businessName: place.businessName,
            category: place.category,
            address: place.address,
            city: place.city,
            phone: place.phone,
            websiteUrl: place.websiteUrl,
            mapsUrl: place.mapsUrl,
            businessHours: place.businessHours ?? null,
            rating: place.rating?.toString() ?? null,
            reviewCount: place.reviewCount,
            sourceQuery,
            sourceType: "google_places",
            sourceRunId: run.id,
            auditStatus,
            dedupeKey,
          })
          .returning();

        await applyPreliminaryScore(lead.id);
        saved += 1;
      } catch {
        // duplicate dedupe key across runs — skip
      }
    }

    await db
      .update(searchRuns)
      .set({ totalFound: saved })
      .where(eq(searchRuns.id, run.id));

    after(async () => {
      await enqueueAuditsForRun(run.id);
    });

    redirect(`/search/${run.id}`);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    return {
      error:
        error instanceof Error ? error.message : "Search failed. Try again.",
    };
  }
}
