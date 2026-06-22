import { getEnv } from "@/lib/env";
import {
  formatCategory,
  parseCityFromAddress,
  type PlaceResult,
} from "./dedupe";
import { formatOpeningHours } from "@/lib/business-hours";
import { getMockPlaces } from "./mock";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.types",
  "places.primaryType",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.googleMapsUri",
  "places.regularOpeningHours",
].join(",");

type PlacesApiPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  types?: string[];
  primaryType?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  googleMapsUri?: string;
  regularOpeningHours?: {
    weekdayDescriptions?: string[];
  };
};

export async function searchPlaces(
  niche: string,
  location: string,
  maxResults: number,
): Promise<PlaceResult[]> {
  const { isMockMode, googlePlacesApiKey } = getEnv();
  const textQuery = `${niche} in ${location}`;

  if (isMockMode) {
    return getMockPlaces(niche, location, maxResults);
  }

  const results: PlaceResult[] = [];
  let pageToken: string | undefined;

  while (results.length < maxResults) {
    const pageSize = Math.min(20, maxResults - results.length);
    const body: Record<string, unknown> = {
      textQuery,
      pageSize,
    };
    if (pageToken) body.pageToken = pageToken;

    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": googlePlacesApiKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Places API error (${response.status}): ${text}`);
    }

    const data = (await response.json()) as {
      places?: PlacesApiPlace[];
      nextPageToken?: string;
    };

    for (const place of data.places ?? []) {
      if (place.businessStatus === "CLOSED_PERMANENTLY") continue;

      const address = place.formattedAddress ?? null;
      results.push({
        placeId: place.id ?? crypto.randomUUID(),
        businessName: place.displayName?.text ?? "Unknown",
        category: formatCategory(place.types, place.primaryType),
        address,
        city: parseCityFromAddress(address),
        phone:
          place.nationalPhoneNumber ??
          place.internationalPhoneNumber ??
          null,
        websiteUrl: place.websiteUri ?? null,
        mapsUrl:
          place.googleMapsUri ??
          (place.id
            ? `https://www.google.com/maps/place/?q=place_id:${place.id.replace("places/", "")}`
            : null),
        rating: place.rating ?? null,
        reviewCount: place.userRatingCount ?? null,
        businessStatus: place.businessStatus ?? null,
        businessHours: formatOpeningHours(
          place.regularOpeningHours?.weekdayDescriptions,
        ),
      });

      if (results.length >= maxResults) break;
    }

    if (!data.nextPageToken || results.length >= maxResults) break;
    pageToken = data.nextPageToken;
    await new Promise((r) => setTimeout(r, 300));
  }

  return results.slice(0, maxResults);
}
