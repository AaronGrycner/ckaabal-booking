import { createHash, randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import type { getDb } from "@/lib/db";
import {
  leads,
  outreachLinkClicks,
  trackedOutreachLinks,
  type TrackedOutreachLink,
} from "@/lib/db/schema";
import { recordActivity } from "@/lib/services/crm";

type Db = ReturnType<typeof getDb>;

const BOT_UA_PATTERNS = [
  "bot",
  "crawler",
  "spider",
  "preview",
  "facebookexternalhit",
  "slackbot",
  "discordbot",
  "linkedinbot",
  "twitterbot",
  "googlebot",
  "bingbot",
];

export type OutreachTrackingConfig = {
  publicSiteUrl: string;
  trackingBaseUrl: string;
  defaultDestinationUrl: string;
  displayWebsite: string | null;
  ipHashSalt: string | null;
};

export type OutreachLinkClickMetadata = {
  trackedLinkId: number;
  linkType: string;
  destinationUrl: string;
  userAgent: string | null;
  referrer: string | null;
  isLikelyBot: boolean;
};

function normalizeTrackingBaseUrl(raw: string): string {
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  // Accidental paste of a full .env line as the value (e.g. on Vercel).
  const envLineMatch = value.match(
    /^(?:OUTREACH_TRACKING_BASE_URL=)(https?:\/\/.+)$/i,
  );
  if (envLineMatch) {
    return envLineMatch[1].replace(/\/$/, "");
  }

  const genericEnvMatch = value.match(/^[\w_]+=(https?:\/\/.+)$/i);
  if (genericEnvMatch) {
    return genericEnvMatch[1].replace(/\/$/, "");
  }

  return value.replace(/\/$/, "");
}

export function getOutreachTrackingConfig(): OutreachTrackingConfig {
  const publicSiteUrl =
    process.env.PUBLIC_SITE_URL?.trim() || "https://ckaabal.com";
  const trackingBaseUrlRaw =
    process.env.OUTREACH_TRACKING_BASE_URL?.trim() ||
    process.env.PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000";
  const trackingBaseUrl = normalizeTrackingBaseUrl(trackingBaseUrlRaw);
  const defaultDestinationUrl =
    process.env.OUTREACH_DEFAULT_TRACKED_DESTINATION?.trim() ||
    process.env.OUTREACH_EPK_URL?.trim() ||
    `${publicSiteUrl.replace(/\/$/, "")}/?utm_source=booking_email&utm_medium=email&utm_campaign=outreach&utm_content=signature`;
  const displayWebsite = process.env.OUTREACH_WEBSITE?.trim() || null;
  const ipHashSalt = process.env.OUTREACH_CLICK_IP_HASH_SALT?.trim() || null;

  return {
    publicSiteUrl: publicSiteUrl.replace(/\/$/, ""),
    trackingBaseUrl,
    defaultDestinationUrl,
    displayWebsite,
    ipHashSalt,
  };
}

export function generateTrackingToken(): string {
  return randomBytes(24).toString("base64url");
}

export function buildTrackedLinkUrl(token: string): string {
  const { trackingBaseUrl } = getOutreachTrackingConfig();
  return `${trackingBaseUrl}/r/${token}`;
}

export function isLikelyBotUserAgent(userAgent: string | null): boolean {
  if (!userAgent?.trim()) return false;
  const normalized = userAgent.toLowerCase();
  return BOT_UA_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function hashClickIp(ip: string | null): string | null {
  if (!ip?.trim()) return null;
  const { ipHashSalt } = getOutreachTrackingConfig();
  if (!ipHashSalt) return null;
  return createHash("sha256")
    .update(`${ipHashSalt}${ip.trim()}`)
    .digest("hex");
}

export function extractClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || null;
}

function websiteUrlVariants(website: string): string[] {
  const trimmed = website.trim();
  if (!trimmed) return [];

  const variants = new Set<string>([trimmed]);

  const withoutProtocol = trimmed.replace(/^https?:\/\//i, "");
  variants.add(withoutProtocol);
  variants.add(`https://${withoutProtocol}`);
  variants.add(`http://${withoutProtocol}`);

  const withoutWww = withoutProtocol.replace(/^www\./i, "");
  variants.add(withoutWww);
  variants.add(`www.${withoutWww}`);
  variants.add(`https://${withoutWww}`);
  variants.add(`https://www.${withoutWww}`);
  variants.add(`http://${withoutWww}`);
  variants.add(`http://www.${withoutWww}`);

  return [...variants];
}

function standaloneWebsiteVariantSet(website: string): Set<string> {
  return new Set(
    websiteUrlVariants(website).map((variant) => variant.toLowerCase()),
  );
}

function replaceLineWithTrackedUrl(
  line: string,
  trimmed: string,
  allowedVariants: Set<string>,
  trackedUrl: string,
): string {
  if (!trimmed) return line;

  if (!trimmed.includes("@")) {
    if (allowedVariants.has(trimmed.toLowerCase())) return trackedUrl;
    return line;
  }

  // Model sometimes glues website + email on one line (dreamlabwebdesign.comhello@...).
  const lower = trimmed.toLowerCase();
  const sortedVariants = [...allowedVariants].sort(
    (a, b) => b.length - a.length,
  );
  for (const variant of sortedVariants) {
    if (!lower.startsWith(variant) || trimmed.length <= variant.length) continue;
    const rest = trimmed.slice(variant.length);
    if (!rest.includes("@")) continue;

    const leadingWhitespace = line.match(/^\s*/)?.[0] ?? "";
    return `${leadingWhitespace}${trackedUrl}\n${leadingWhitespace}${rest}`;
  }

  return line;
}

export function replaceSignatureUrlInEmailBody(
  body: string,
  trackedUrl: string,
): string {
  const { displayWebsite } = getOutreachTrackingConfig();
  if (!displayWebsite) return body;

  const allowedVariants = standaloneWebsiteVariantSet(displayWebsite);

  return body
    .split("\n")
    .map((line) =>
      replaceLineWithTrackedUrl(line, line.trim(), allowedVariants, trackedUrl),
    )
    .join("\n");
}

function isLocalDevDestination(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}

/** Use stored destination unless it was saved from local dev against shared prod DB. */
export function resolveTrackedLinkDestination(storedDestinationUrl: string): string {
  const { defaultDestinationUrl } = getOutreachTrackingConfig();
  if (!isLocalDevDestination(storedDestinationUrl)) {
    return storedDestinationUrl;
  }
  if (isLocalDevDestination(defaultDestinationUrl)) {
    return storedDestinationUrl;
  }
  return defaultDestinationUrl;
}

export async function getOrCreateSignatureTrackedLink(
  db: Db,
  leadId: number,
): Promise<TrackedOutreachLink> {
  const existing = await db.query.trackedOutreachLinks.findFirst({
    where: and(
      eq(trackedOutreachLinks.leadId, leadId),
      eq(trackedOutreachLinks.linkType, "signature"),
      eq(trackedOutreachLinks.isActive, true),
    ),
  });
  if (existing) {
    const resolvedDestination = resolveTrackedLinkDestination(
      existing.destinationUrl,
    );
    if (resolvedDestination !== existing.destinationUrl) {
      const [updated] = await db
        .update(trackedOutreachLinks)
        .set({ destinationUrl: resolvedDestination })
        .where(eq(trackedOutreachLinks.id, existing.id))
        .returning();
      return updated ?? existing;
    }
    return existing;
  }

  const { defaultDestinationUrl } = getOutreachTrackingConfig();
  const token = generateTrackingToken();

  const [created] = await db
    .insert(trackedOutreachLinks)
    .values({
      token,
      leadId,
      destinationUrl: defaultDestinationUrl,
      linkType: "signature",
      isActive: true,
    })
    .returning();

  return created;
}

export async function findActiveTrackedLinkByToken(
  db: Db,
  token: string,
): Promise<TrackedOutreachLink | null> {
  const link = await db.query.trackedOutreachLinks.findFirst({
    where: eq(trackedOutreachLinks.token, token),
  });
  if (!link || !link.isActive) return null;
  return link;
}

export async function getSignatureTrackedLinkForLead(
  db: Db,
  leadId: number,
): Promise<TrackedOutreachLink | null> {
  return (
    (await db.query.trackedOutreachLinks.findFirst({
      where: and(
        eq(trackedOutreachLinks.leadId, leadId),
        eq(trackedOutreachLinks.linkType, "signature"),
        eq(trackedOutreachLinks.isActive, true),
      ),
    })) ?? null
  );
}

export async function recordOutreachLinkClick(
  db: Db,
  link: TrackedOutreachLink,
  headers: Headers,
): Promise<void> {
  const userAgent = headers.get("user-agent");
  const referrer = headers.get("referer");
  const ipHash = hashClickIp(extractClientIp(headers));
  const isLikelyBot = isLikelyBotUserAgent(userAgent);
  const now = new Date();

  await db.insert(outreachLinkClicks).values({
    trackedLinkId: link.id,
    leadId: link.leadId,
    clickedAt: now,
    userAgent,
    referrer,
    ipHash,
    country: null,
    city: null,
  });

  if (!isLikelyBot) {
    await db
      .update(trackedOutreachLinks)
      .set({
        clickCount: link.clickCount + 1,
        lastClickedAt: now,
      })
      .where(eq(trackedOutreachLinks.id, link.id));

    const lead = await db.query.leads.findFirst({
      where: eq(leads.id, link.leadId),
    });

    await db
      .update(leads)
      .set({
        lastEmailClickedAt: now,
        emailClickCount: (lead?.emailClickCount ?? 0) + 1,
        updatedAt: now,
      })
      .where(eq(leads.id, link.leadId));
  }

  const metadata: OutreachLinkClickMetadata = {
    trackedLinkId: link.id,
    linkType: link.linkType,
    destinationUrl: link.destinationUrl,
    userAgent,
    referrer,
    isLikelyBot,
  };

  await recordActivity(db, {
    leadId: link.leadId,
    activityType: "outreach_link_clicked",
    summary: "Clicked email link",
    metadataJson: JSON.stringify(metadata),
  });
}

export type OutreachEmailBodyWithTracking = {
  text: string;
  html: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getSignatureLinkDisplayText(): string | null {
  const { displayWebsite } = getOutreachTrackingConfig();
  if (!displayWebsite) return null;

  return displayWebsite
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
}

function buildSignatureTrackedLinkAnchor(trackedUrl: string): string {
  const label = getSignatureLinkDisplayText() ?? trackedUrl;
  return `<a href="${escapeHtml(trackedUrl)}">${escapeHtml(label)}</a>`;
}

function formatOutreachEmailHtml(body: string): string {
  const anchorLinePattern = /^(\s*)<a href="([^"]+)">([^<]*)<\/a>(\s*)$/;
  const htmlLines = body.split("\n").map((line) => {
    const anchorMatch = anchorLinePattern.exec(line);
    if (anchorMatch) {
      return `${anchorMatch[1]}<a href="${anchorMatch[2]}">${anchorMatch[3]}</a>${anchorMatch[4]}`;
    }
    return escapeHtml(line);
  });

  return `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.5;">${htmlLines.join("<br>\n")}</div>`;
}

export function prepareOutreachEmailBodyWithTrackedLink(
  body: string,
  trackedLink: TrackedOutreachLink,
): OutreachEmailBodyWithTracking {
  const trackedUrl = buildTrackedLinkUrl(trackedLink.token);
  const linkHtml = buildSignatureTrackedLinkAnchor(trackedUrl);
  const text = replaceSignatureUrlInEmailBody(body, trackedUrl);
  const html = formatOutreachEmailHtml(
    replaceSignatureUrlInEmailBody(body, linkHtml),
  );

  return { text, html };
}
