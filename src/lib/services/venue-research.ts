export type VenueResearch = {
  liveMusicSignals: string[];
  detectedGenres: string[];
  hasTalentBookingPage: boolean;
  hasShowsCalendar: boolean;
  hasSubmissionForm: boolean;
  submissionUrl: string | null;
};

const GENRE_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "indie rock", pattern: /\bindie[\s-]?rock\b/i },
  { label: "rock", pattern: /\brock\b/i },
  { label: "alternative", pattern: /\balternative\b/i },
  { label: "folk", pattern: /\bfolk\b/i },
  { label: "americana", pattern: /\bamericana\b/i },
  { label: "country", pattern: /\bcountry\b/i },
  { label: "blues", pattern: /\bblues\b/i },
  { label: "jazz", pattern: /\bjazz\b/i },
  { label: "soul", pattern: /\bsoul\b/i },
  { label: "r&b", pattern: /\br\s*&\s*b\b/i },
  { label: "hip hop", pattern: /\bhip[\s-]?hop\b/i },
  { label: "rap", pattern: /\brap\b/i },
  { label: "electronic", pattern: /\belectronic\b|\bedm\b/i },
  { label: "metal", pattern: /\bmetal\b/i },
  { label: "punk", pattern: /\bpunk\b/i },
  { label: "singer-songwriter", pattern: /\bsinger[\s-]?songwriter\b/i },
  { label: "acoustic", pattern: /\bacoustic\b/i },
  { label: "latin", pattern: /\blatin\b/i },
  { label: "reggae", pattern: /\breggae\b/i },
];

const LIVE_MUSIC_SIGNALS: { label: string; pattern: RegExp }[] = [
  { label: "Live music advertised", pattern: /\blive music\b/i },
  { label: "Upcoming shows listed", pattern: /\bupcoming shows?\b|\bshow calendar\b/i },
  { label: "Concert listings", pattern: /\bconcerts?\b/i },
  { label: "Talent buyer mentioned", pattern: /\btalent buyer\b|\bbooking agent\b/i },
  { label: "Band submissions accepted", pattern: /\bsubmit (your )?band\b|\bband submissions?\b/i },
  { label: "EPK or press kit requested", pattern: /\bepk\b|\bpress kit\b|\belectronic press kit\b/i },
  { label: "Open mic nights", pattern: /\bopen mic\b/i },
  { label: "Local acts featured", pattern: /\blocal acts?\b|\blocal bands?\b/i },
];

const TALENT_BOOKING_PATH =
  /\/(book(ing)?|talent|submit|submission|epk|press|artists?|bands?|hire|perform)\b/i;

const SHOWS_CALENDAR_PATH = /\/(shows?|events?|calendar|gig)/i;

const SUBMISSION_PATH =
  /\/(submit|submission|book(ing)?|talent|epk|press|contact)\b/i;

export function extractSubmissionUrl(html: string, pageUrl: string): string | null {
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) continue;
    const lower = href.toLowerCase();
    if (
      SUBMISSION_PATH.test(lower) ||
      lower.includes("submit") ||
      lower.includes("booking") ||
      lower.includes("talent")
    ) {
      try {
        return new URL(href, pageUrl).toString();
      } catch {
        continue;
      }
    }
  }
  return null;
}

export function analyzeVenueResearch(
  text: string,
  html: string,
  pageUrl: string,
): VenueResearch {
  const combined = `${text}\n${html}`;
  const detectedGenres: string[] = [];
  const liveMusicSignals: string[] = [];

  for (const { label, pattern } of GENRE_PATTERNS) {
    if (pattern.test(combined) && !detectedGenres.includes(label)) {
      detectedGenres.push(label);
    }
  }

  for (const { label, pattern } of LIVE_MUSIC_SIGNALS) {
    if (pattern.test(combined)) {
      liveMusicSignals.push(label);
    }
  }

  const lowerHtml = html.toLowerCase();
  const hasTalentBookingPage =
    TALENT_BOOKING_PATH.test(lowerHtml) ||
    /\bbook (a )?band\b|\bhire (a )?band\b|\btalent submission\b/i.test(combined);

  const hasShowsCalendar =
    SHOWS_CALENDAR_PATH.test(lowerHtml) ||
    /\bupcoming (shows?|events?)\b|\bshow calendar\b|\bevent calendar\b/i.test(
      combined,
    );

  const hasSubmissionForm =
    /\bsubmit\b.*\b(band|act|artist|booking)\b/i.test(combined) ||
    (/<form[^>]*>/i.test(html) &&
      /\b(booking|talent|submit|artist)\b/i.test(combined));

  return {
    liveMusicSignals,
    detectedGenres: detectedGenres.slice(0, 6),
    hasTalentBookingPage,
    hasShowsCalendar,
    hasSubmissionForm,
    submissionUrl: extractSubmissionUrl(html, pageUrl),
  };
}

export function formatGenreList(genres: string[]) {
  if (!genres.length) return null;
  if (genres.length === 1) return genres[0];
  if (genres.length === 2) return `${genres[0]} and ${genres[1]}`;
  return `${genres.slice(0, -1).join(", ")}, and ${genres[genres.length - 1]}`;
}
