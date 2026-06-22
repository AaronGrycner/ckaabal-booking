import type { CheerioAPI } from "cheerio";

export type EmailConfidence = "high" | "medium" | "low";
export type PageKind = "homepage" | "contact";

export type ExtractedEmail = {
  email: string;
  confidence: EmailConfidence;
  source: string;
  pageUrl: string;
};

export type ContactsData = {
  emails: ExtractedEmail[];
  bestEmail: string | null;
  emailConfidence: EmailConfidence | null;
  emailSource: string | null;
  phones: string[];
  instagramUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  pagesCrawled: string[];
};

export type PageExtraction = {
  emails: ExtractedEmail[];
  phones: string[];
  instagramUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
};

const PREFIX_PRIORITY = [
  "bookings@",
  "booking@",
  "talent@",
  "music@",
  "events@",
  "hello@",
  "info@",
  "contact@",
  "office@",
  "appointments@",
];

const JUNK_LOCAL_PREFIXES = [
  "noreply@",
  "no-reply@",
  "donotreply@",
  "do-not-reply@",
  "example@",
  "test@",
  "privacy@",
  "legal@",
  "abuse@",
  "postmaster@",
  "webmaster@",
  "support@wix",
];

const JUNK_EMAIL_DOMAINS = [
  "sentry.io",
  "cloudflare.com",
  "wordpress.com",
  "squarespace.com",
  "weebly.com",
  "godaddy.com",
  "wixpress.com",
  "domain.com",
  "email.com",
  "yourdomain.com",
];

const EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const PHONE_REGEX =
  /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g;

const CONTACT_PATH_PRIORITY = [
  /\/book(ing)?\b/i,
  /\/talent\b/i,
  /\/submit\b/i,
  /\/artists?\b/i,
  /\/contact-us\b/i,
  /\/contact\b/i,
  /\/get-in-touch\b/i,
  /\/reach-us\b/i,
];

const CONFIDENCE_RANK: Record<EmailConfidence, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const FILE_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i;

export function stripTrailingPunctuation(raw: string) {
  return raw.replace(/[,;.)\]}>]+$/g, "").trim();
}

export function normalizeEmail(raw: string) {
  const cleaned = stripTrailingPunctuation(
    raw.trim().toLowerCase().replace(/^mailto:/i, "").split("?")[0] ?? "",
  );
  return cleaned;
}

export function isValidEmail(email: string) {
  if (!email.includes("@")) return false;
  const [local, domain] = email.split("@");
  if (!local || !domain || !domain.includes(".")) return false;
  if (FILE_EXTENSIONS.test(email)) return false;
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email);
}

export function isJunkEmail(email: string) {
  const lower = email.toLowerCase();
  if (JUNK_LOCAL_PREFIXES.some((p) => lower.startsWith(p))) return true;

  const domain = lower.split("@")[1] ?? "";
  if (
    JUNK_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))
  ) {
    return true;
  }

  if (FILE_EXTENSIONS.test(lower)) return true;
  return false;
}

function acceptEmail(raw: string): string | null {
  const email = normalizeEmail(raw);
  if (!email || !isValidEmail(email) || isJunkEmail(email)) return null;
  return email;
}

function pageLabel(pageKind: PageKind) {
  return pageKind === "contact" ? "contact page" : "homepage";
}

function sourceLabel(
  pageKind: PageKind,
  kind: "mailto link" | "visible text" | "html attribute",
) {
  return `${pageLabel(pageKind)} ${kind}`;
}

function isContactPageSource(source: string) {
  return source.startsWith("contact page");
}

function prefixRank(email: string) {
  const idx = PREFIX_PRIORITY.findIndex((p) => email.startsWith(p));
  return idx >= 0 ? idx : PREFIX_PRIORITY.length;
}

function compareExtractedEmails(a: ExtractedEmail, b: ExtractedEmail) {
  const confDiff =
    CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence];
  if (confDiff !== 0) return confDiff;

  const prefixDiff = prefixRank(a.email) - prefixRank(b.email);
  if (prefixDiff !== 0) return prefixDiff;

  const aContact = isContactPageSource(a.source) ? 0 : 1;
  const bContact = isContactPageSource(b.source) ? 0 : 1;
  if (aContact !== bContact) return aContact - bContact;

  return a.email.localeCompare(b.email);
}

function upsertEmail(map: Map<string, ExtractedEmail>, candidate: ExtractedEmail) {
  const existing = map.get(candidate.email);
  if (!existing || compareExtractedEmails(candidate, existing) < 0) {
    map.set(candidate.email, candidate);
  }
}

function extractEmailsFromMatches(
  text: string,
  confidence: EmailConfidence,
  source: string,
  pageUrl: string,
  into: Map<string, ExtractedEmail>,
) {
  const matches = text.match(EMAIL_REGEX) ?? [];
  for (const match of matches) {
    const email = acceptEmail(match);
    if (!email) continue;
    upsertEmail(into, { email, confidence, source, pageUrl });
  }
}

function collectEmailsFromHtml(
  $: CheerioAPI,
  pageUrl: string,
  pageKind: PageKind,
) {
  const byEmail = new Map<string, ExtractedEmail>();

  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const email = acceptEmail(href);
    if (!email) return;
    upsertEmail(byEmail, {
      email,
      confidence: "high",
      source: sourceLabel(pageKind, "mailto link"),
      pageUrl,
    });
  });

  extractEmailsFromMatches(
    $("body").text(),
    "medium",
    sourceLabel(pageKind, "visible text"),
    pageUrl,
    byEmail,
  );

  $("[href], [src], [data-email], [data-mail]").each((_, el) => {
    const attrs: string[] = [];
    const elAttrs = (el as { attribs?: Record<string, string> }).attribs ?? {};
    for (const [name, value] of Object.entries(elAttrs)) {
      if (name.startsWith("data-") || name === "href" || name === "src") {
        if (
          name === "href" &&
          (value.startsWith("mailto:") || value.startsWith("tel:"))
        ) {
          continue;
        }
        attrs.push(value);
      }
    }

    for (const val of attrs) {
      extractEmailsFromMatches(
        val,
        "low",
        sourceLabel(pageKind, "html attribute"),
        pageUrl,
        byEmail,
      );
    }
  });

  return [...byEmail.values()];
}

function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw.trim();
}

function normalizeSocialUrl(
  url: string,
  platform: "instagram" | "facebook" | "linkedin",
) {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = parsed.hostname.replace(/^www\./, "");

    if (platform === "instagram" && !host.includes("instagram.com")) return null;
    if (platform === "facebook" && !host.includes("facebook.com")) return null;
    if (platform === "linkedin" && !host.includes("linkedin.com")) return null;

    if (platform === "facebook") {
      const path = parsed.pathname.toLowerCase();
      if (path.includes("/sharer") || path.includes("/share.php")) return null;
    }

    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function pickBestEmail(candidates: ExtractedEmail[]): {
  bestEmail: string | null;
  emailConfidence: EmailConfidence | null;
  emailSource: string | null;
} {
  if (!candidates.length) {
    return { bestEmail: null, emailConfidence: null, emailSource: null };
  }

  const sorted = [...candidates].sort(compareExtractedEmails);
  const best = sorted[0]!;
  return {
    bestEmail: best.email,
    emailConfidence: best.confidence,
    emailSource: best.source,
  };
}

function collectPhonesFromHtml($: CheerioAPI) {
  const phones = new Set<string>();

  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const raw = href.replace(/^tel:/i, "").trim();
    if (raw) phones.add(normalizePhone(raw));
  });

  const text = $("body").text();
  const matches = text.match(PHONE_REGEX) ?? [];
  for (const match of matches) {
    phones.add(normalizePhone(match));
  }

  return [...phones];
}

function collectSocialUrl(
  $: CheerioAPI,
  platform: "instagram" | "facebook" | "linkedin",
) {
  const pattern =
    platform === "instagram"
      ? /instagram\.com/i
      : platform === "facebook"
        ? /facebook\.com/i
        : /linkedin\.com/i;

  let found: string | null = null;

  $("a[href]").each((_, el) => {
    if (found) return;
    const href = $(el).attr("href") ?? "";
    if (pattern.test(href)) {
      found = normalizeSocialUrl(href, platform);
    }
  });

  if (!found) {
    const ogUrl = $('meta[property="og:url"]').attr("content");
    if (ogUrl && pattern.test(ogUrl)) {
      found = normalizeSocialUrl(ogUrl, platform);
    }
  }

  return found;
}

export function extractContactsFromHtml(
  $: CheerioAPI,
  _html: string,
  pageUrl: string,
  pageKind: PageKind,
): PageExtraction {
  const emails = collectEmailsFromHtml($, pageUrl, pageKind);
  const phones = collectPhonesFromHtml($);

  return {
    emails,
    phones,
    instagramUrl: collectSocialUrl($, "instagram"),
    facebookUrl: collectSocialUrl($, "facebook"),
    linkedinUrl: collectSocialUrl($, "linkedin"),
  };
}

export function mergeContacts(
  parts: PageExtraction[],
  pagesCrawled: string[],
): ContactsData {
  const byEmail = new Map<string, ExtractedEmail>();
  const phones = new Set<string>();
  let instagramUrl: string | null = null;
  let facebookUrl: string | null = null;
  let linkedinUrl: string | null = null;

  for (const part of parts) {
    for (const entry of part.emails) {
      upsertEmail(byEmail, entry);
    }
    for (const p of part.phones) phones.add(p);
    instagramUrl ??= part.instagramUrl;
    facebookUrl ??= part.facebookUrl;
    linkedinUrl ??= part.linkedinUrl;
  }

  const emails = [...byEmail.values()];
  const { bestEmail, emailConfidence, emailSource } = pickBestEmail(emails);

  return {
    emails,
    bestEmail,
    emailConfidence,
    emailSource,
    phones: [...phones],
    instagramUrl,
    facebookUrl,
    linkedinUrl,
    pagesCrawled,
  };
}

export function findContactPageUrl(
  $: CheerioAPI,
  baseUrl: string,
): string | null {
  let origin: URL;
  try {
    origin = new URL(baseUrl);
  } catch {
    return null;
  }

  type Candidate = { url: string; score: number };
  const candidates: Candidate[] = [];

  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (
      !href ||
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:")
    ) {
      return;
    }

    const label = $(el).text().toLowerCase();
    const hrefLower = href.toLowerCase();
    const isContact =
      hrefLower.includes("contact") ||
      hrefLower.includes("get-in-touch") ||
      label.includes("contact");

    if (!isContact) return;

    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.origin !== origin.origin) return;
      if (resolved.pathname === origin.pathname) return;

      let score = 10;
      for (let i = 0; i < CONTACT_PATH_PRIORITY.length; i++) {
        if (CONTACT_PATH_PRIORITY[i].test(resolved.pathname)) {
          score = i;
          break;
        }
      }

      candidates.push({ url: resolved.toString(), score });
    } catch {
      // skip invalid URLs
    }
  });

  if (!candidates.length) return null;

  candidates.sort((a, b) => a.score - b.score);
  return candidates[0]?.url ?? null;
}
