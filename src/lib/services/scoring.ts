import type { Lead, WebsiteAudit } from "@/lib/db/schema";
import { getAuditIssues } from "@/lib/parse-audit-issues";
import { formatGenreList } from "./venue-research";

const CHAIN_VENUES = [
  "house of blues",
  "live nation",
  "bowery presents",
  "aeg presents",
  "ticketmaster",
  "starbucks",
  "mcdonald",
  "walmart",
  "target",
];

const VENUE_TYPES = [
  "bar",
  "night_club",
  "nightclub",
  "music_venue",
  "concert_hall",
  "performing_arts_theater",
  "performing arts theater",
  "event_venue",
  "festival",
  "amphitheatre",
  "amphitheater",
  "live music",
  "music venue",
  "concert venue",
  "jazz club",
  "comedy club",
  "brewery",
  "winery",
  "restaurant",
  "lounge",
];

const NON_MUSIC_TYPES = [
  "hair_salon",
  "beauty_salon",
  "nail_salon",
  "dentist",
  "doctor",
  "veterinary",
  "plumber",
  "lawyer",
  "accounting",
  "gym",
  "spa",
];

export type ScoreResult = {
  fitScore: number;
  fitLabel: "Excellent fit" | "Good fit" | "Maybe" | "Skip";
  mainIssue: string;
};

function getFitLabel(score: number): ScoreResult["fitLabel"] {
  if (score >= 80) return "Excellent fit";
  if (score >= 60) return "Good fit";
  if (score >= 40) return "Maybe";
  return "Skip";
}

function isChain(name: string) {
  const lower = name.toLowerCase();
  return CHAIN_VENUES.some((chain) => lower.includes(chain));
}

function isMusicVenue(category: string | null) {
  if (!category) return false;
  const normalized = category.toLowerCase();
  return VENUE_TYPES.some(
    (t) =>
      normalized.includes(t.replace(/_/g, " ")) ||
      normalized.includes(t.replace(/_/g, "")),
  );
}

function isNonMusicBusiness(category: string | null) {
  if (!category) return false;
  const normalized = category.toLowerCase();
  return NON_MUSIC_TYPES.some((t) => normalized.includes(t.replace(/_/g, " ")));
}

function getVenueResearch(audit?: WebsiteAudit | null) {
  return getAuditIssues(audit)?.venueResearch ?? null;
}

function scoreContactSignals(
  lead: Pick<Lead, "phone" | "contactEmail" | "websiteUrl">,
  audit?: WebsiteAudit | null,
) {
  let score = 0;
  const signals: { issue: string; weight: number }[] = [];

  if (lead.contactEmail?.trim()) {
    score += 20;
    signals.push({ issue: "Booker email found", weight: 20 });
  }

  if (audit?.hasBookingLink) {
    score += 18;
    signals.push({ issue: "Talent booking link on site", weight: 18 });
  }

  if (audit?.hasContactLink) {
    score += 10;
    signals.push({ issue: "Contact path on website", weight: 10 });
  }

  if (lead.phone?.trim() || audit?.hasPhone) {
    score += 8;
    signals.push({ issue: "Phone number available", weight: 8 });
  }

  if (!lead.websiteUrl) {
    score -= 8;
    signals.push({ issue: "No website to research", weight: -8 });
  }

  return { score, signals };
}

function scoreVenueResearch(audit?: WebsiteAudit | null) {
  let score = 0;
  const signals: { issue: string; weight: number }[] = [];
  const research = getVenueResearch(audit);

  if (!research) return { score, signals };

  if (research.liveMusicSignals.length > 0) {
    score += 22;
    signals.push({
      issue: `Books live music (${research.liveMusicSignals[0]})`,
      weight: 22,
    });
  }

  if (research.detectedGenres.length > 0) {
    const genres = formatGenreList(research.detectedGenres);
    score += 15;
    signals.push({
      issue: genres ? `Genre focus: ${genres}` : "Genre signals on site",
      weight: 15,
    });
  }

  if (research.hasShowsCalendar) {
    score += 12;
    signals.push({ issue: "Shows calendar on site", weight: 12 });
  }

  if (research.hasTalentBookingPage || research.hasSubmissionForm) {
    score += 14;
    signals.push({ issue: "Accepts talent submissions", weight: 14 });
  }

  if (research.submissionUrl) {
    score += 6;
    signals.push({ issue: "Submission URL found", weight: 6 });
  }

  return { score, signals };
}

export function scoreFromPlacesOnly(
  lead: Pick<
    Lead,
    "businessName" | "category" | "websiteUrl" | "rating" | "reviewCount"
  >,
): ScoreResult {
  let score = 0;
  const signals: { issue: string; weight: number }[] = [];

  if (isMusicVenue(lead.category)) {
    score += 25;
    signals.push({ issue: "Live music venue type", weight: 25 });
  }

  if (isNonMusicBusiness(lead.category)) {
    score -= 25;
    signals.push({ issue: "Not a typical music venue", weight: -25 });
  }

  if (lead.websiteUrl) {
    score += 10;
    signals.push({ issue: "Website listed", weight: 10 });
  } else {
    score -= 5;
    signals.push({ issue: "No website listed", weight: -5 });
  }

  const rating = lead.rating ? parseFloat(lead.rating) : null;
  const reviews = lead.reviewCount ?? 0;

  if (rating !== null && rating >= 4.0) {
    score += 10;
    signals.push({ issue: "Strong venue rating", weight: 10 });
  }

  if (reviews >= 30) {
    score += 8;
    signals.push({ issue: "Active venue (many reviews)", weight: 8 });
  }

  if (isChain(lead.businessName)) {
    score -= 15;
    signals.push({ issue: "Large chain or corporate venue", weight: -15 });
  }

  score = Math.max(0, Math.min(100, score));
  signals.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

  return {
    fitScore: score,
    fitLabel: getFitLabel(score),
    mainIssue: signals[0]?.issue ?? "Review manually",
  };
}

export function scoreFull(
  lead: Pick<
    Lead,
    | "businessName"
    | "category"
    | "websiteUrl"
    | "rating"
    | "reviewCount"
    | "phone"
    | "contactEmail"
  >,
  audit?: WebsiteAudit | null,
): ScoreResult {
  let score = 0;
  const signals: { issue: string; weight: number }[] = [];

  if (isMusicVenue(lead.category)) {
    score += 20;
    signals.push({ issue: "Live music venue type", weight: 20 });
  }

  if (isNonMusicBusiness(lead.category)) {
    score -= 25;
    signals.push({ issue: "Not a typical music venue", weight: -25 });
  }

  const contact = scoreContactSignals(lead, audit);
  score += contact.score;
  signals.push(...contact.signals);

  const research = scoreVenueResearch(audit);
  score += research.score;
  signals.push(...research.signals);

  const rating = lead.rating ? parseFloat(lead.rating) : null;
  const reviews = lead.reviewCount ?? 0;

  if (rating !== null && rating >= 4.0) {
    score += 8;
    signals.push({ issue: "Strong venue rating", weight: 8 });
  }

  if (reviews >= 30) {
    score += 6;
    signals.push({ issue: "Active venue (many reviews)", weight: 6 });
  }

  if (isChain(lead.businessName)) {
    score -= 12;
    signals.push({ issue: "Large chain or corporate venue", weight: -12 });
  }

  if (
    audit &&
    !audit.hasBookingLink &&
    !audit.hasContactLink &&
    !lead.contactEmail?.trim()
  ) {
    score -= 12;
    signals.push({ issue: "No clear booker contact path", weight: -12 });
  }

  const venueResearch = getVenueResearch(audit);
  if (
    audit &&
    venueResearch &&
    venueResearch.liveMusicSignals.length === 0 &&
    !isMusicVenue(lead.category)
  ) {
    score -= 10;
    signals.push({ issue: "No live music signals on site", weight: -10 });
  }

  score = Math.max(0, Math.min(100, score));
  signals.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

  return {
    fitScore: score,
    fitLabel: getFitLabel(score),
    mainIssue: signals[0]?.issue ?? "Review manually",
  };
}
