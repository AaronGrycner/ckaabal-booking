export type PlaceResult = {
  placeId: string;
  businessName: string;
  category: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  websiteUrl: string | null;
  mapsUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  businessStatus: string | null;
  businessHours?: string | null;
};

export function normalizeWebsite(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return `${parsed.hostname}${parsed.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function buildDedupeKey(input: {
  businessName: string;
  address?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
}) {
  const website = normalizeWebsite(input.websiteUrl);
  if (website) return `web:${website}`;

  const phone = input.phone?.replace(/\D/g, "");
  if (phone && phone.length >= 10) return `phone:${phone}`;

  const name = input.businessName.trim().toLowerCase();
  const address = (input.address ?? "").trim().toLowerCase();
  return `nameaddr:${name}|${address}`;
}

export function parseCityFromAddress(address: string | null) {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length >= 2) return parts[parts.length - 2] ?? null;
  return null;
}

export function formatCategory(types: string[] | null | undefined, primaryType?: string | null) {
  if (primaryType) return primaryType.replace(/_/g, " ");
  if (!types?.length) return null;
  const skip = new Set(["point_of_interest", "establishment"]);
  const type = types.find((t) => !skip.has(t));
  return type?.replace(/_/g, " ") ?? null;
}
