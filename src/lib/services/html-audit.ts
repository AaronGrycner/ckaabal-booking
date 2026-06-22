import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { getEnv } from "@/lib/env";
import type { BrokenLinksReport, SiteHealthReport } from "@/lib/parse-audit-issues";
import {
  extractContactsFromHtml,
  findContactPageUrl,
  mergeContacts,
  type ContactsData,
  type PageKind,
} from "./contact-extract";
import {
  analyzeVenueResearch,
  type VenueResearch,
} from "./venue-research";
import { getMockHtmlAudit } from "./mock";

const MAX_LINK_CHECKS = 12;
const LINK_CHECK_CONCURRENCY = 3;
const LINK_CHECK_TIMEOUT_MS = 8000;

export type HtmlAuditResult = {
  httpStatus: number | null;
  hasHttps: boolean;
  title: string | null;
  metaDescription: string | null;
  hasPhone: boolean;
  hasContactLink: boolean;
  hasServicesContent: boolean;
  hasBookingLink: boolean;
  detectedBuilder: string | null;
  ecommerceHeavy: boolean;
  brokenLinks: BrokenLinksReport;
  siteHealth: SiteHealthReport;
  bestEmail: string | null;
  emailConfidence: ContactsData["emailConfidence"];
  emailSource: string | null;
  contacts: ContactsData;
  venueResearch: VenueResearch;
  failed?: boolean;
  error?: string;
};

const BUILDER_MARKERS: Record<string, RegExp[]> = {
  Wix: [/wix\.com/i, /wixsite/i, /X-Wix-/i],
  Squarespace: [/squarespace/i, /static1\.squarespace/i],
  Weebly: [/weebly/i],
  GoDaddy: [/godaddy/i, /wsimg\.com/i],
  WordPress: [/wp-content/i, /wordpress/i],
};

const PHONE_REGEX =
  /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/;

const FETCH_HEADERS = {
  "User-Agent": "ckaabal-booking-crm/1.0 (internal venue research; +local)",
  Accept: "text/html",
};

function detectBuilder(html: string) {
  for (const [name, patterns] of Object.entries(BUILDER_MARKERS)) {
    if (patterns.some((p) => p.test(html))) return name;
  }
  return null;
}

function emptySiteHealth(): SiteHealthReport {
  return {
    hasViewportMeta: false,
    hasH1: false,
    h1Count: 0,
    imagesTotal: 0,
    imagesMissingAlt: 0,
    hasNoindex: false,
    hasFavicon: false,
    hasOpenGraph: false,
    wordCount: 0,
    thinContent: true,
  };
}

function emptyBrokenLinks(): BrokenLinksReport {
  return { checked: 0, broken: 0, samples: [] };
}

function isCheckableHref(href: string | undefined) {
  if (!href?.trim()) return false;
  const lower = href.trim().toLowerCase();
  return (
    !lower.startsWith("#") &&
    !lower.startsWith("mailto:") &&
    !lower.startsWith("tel:") &&
    !lower.startsWith("javascript:") &&
    !lower.startsWith("data:")
  );
}

function normalizePageUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.replace(/\/$/, "");
  }
}

function collectSameOriginLinks(pageUrl: string, html: string) {
  const base = new URL(pageUrl);
  const links = new Set<string>();

  const $ = cheerio.load(html);
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!isCheckableHref(href)) return;

    try {
      const resolved = new URL(href!, pageUrl);
      if (resolved.origin !== base.origin) return;
      if (!["http:", "https:"].includes(resolved.protocol)) return;
      links.add(normalizePageUrl(resolved.toString()));
    } catch {
      // skip invalid URLs
    }
  });

  return [...links];
}

async function checkSingleLink(url: string): Promise<{ url: string; status: number | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LINK_CHECK_TIMEOUT_MS);

  try {
    let response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: FETCH_HEADERS,
      redirect: "follow",
    });

    if (response.status === 405 || response.status === 501) {
      response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          ...FETCH_HEADERS,
          Range: "bytes=0-0",
        },
        redirect: "follow",
      });
    }

    return { url, status: response.status };
  } catch {
    return { url, status: null };
  } finally {
    clearTimeout(timeout);
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function runWorker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()),
  );

  return results;
}

async function checkBrokenLinks(
  pages: Array<{ url: string; html: string }>,
): Promise<BrokenLinksReport> {
  const crawled = new Set(pages.map((page) => normalizePageUrl(page.url)));
  const candidates = new Set<string>();

  for (const page of pages) {
    for (const link of collectSameOriginLinks(page.url, page.html)) {
      if (!crawled.has(link)) {
        candidates.add(link);
      }
    }
  }

  const toCheck = [...candidates].slice(0, MAX_LINK_CHECKS);
  if (!toCheck.length) {
    return emptyBrokenLinks();
  }

  const results = await mapPool(toCheck, LINK_CHECK_CONCURRENCY, checkSingleLink);
  const broken = results.filter(
    (result) => result.status == null || result.status >= 400,
  );

  return {
    checked: toCheck.length,
    broken: broken.length,
    samples: broken.slice(0, 5),
  };
}

function analyzeSiteHealth($: CheerioAPI): SiteHealthReport {
  const h1Count = $("h1").length;
  const imagesTotal = $("img").length;
  const imagesMissingAlt = $("img").filter(
    (_, el) => !($(el).attr("alt") ?? "").trim(),
  ).length;
  const robots = ($('meta[name="robots"]').attr("content") ?? "").toLowerCase();
  const wordCount = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return {
    hasViewportMeta: $('meta[name="viewport"]').length > 0,
    hasH1: h1Count > 0,
    h1Count,
    imagesTotal,
    imagesMissingAlt,
    hasNoindex: robots.includes("noindex"),
    hasFavicon: $('link[rel="icon"], link[rel="shortcut icon"]').length > 0,
    hasOpenGraph:
      $('meta[property="og:title"], meta[property="og:description"]').length > 0,
    wordCount,
    thinContent: wordCount < 150,
  };
}

function emptyContacts(): ContactsData {
  return {
    emails: [],
    bestEmail: null,
    emailConfidence: null,
    emailSource: null,
    phones: [],
    instagramUrl: null,
    facebookUrl: null,
    linkedinUrl: null,
    pagesCrawled: [],
  };
}

async function fetchHtml(
  url: string,
): Promise<{ html: string; status: number; finalUrl: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: FETCH_HEADERS,
      redirect: "follow",
    });

    clearTimeout(timeout);
    const html = await response.text();
    return { html, status: response.status, finalUrl: response.url };
  } catch {
    return null;
  }
}

function analyzePage(html: string, pageUrl: string, pageKind: PageKind) {
  const $ = cheerio.load(html);
  const text = $("body").text();
  const lowerHtml = html.toLowerCase();

  const contactLinks = $("a[href]").filter((_, el) => {
    const href = ($(el).attr("href") ?? "").toLowerCase();
    const label = $(el).text().toLowerCase();
    return (
      href.includes("contact") ||
      href.includes("get-in-touch") ||
      label.includes("contact")
    );
  });

  const bookingLinks = $("a[href]").filter((_, el) => {
    const href = ($(el).attr("href") ?? "").toLowerCase();
    const label = $(el).text().toLowerCase();
    return (
      href.includes("book") ||
      href.includes("talent") ||
      href.includes("submit") ||
      href.includes("epk") ||
      href.includes("press") ||
      href.includes("schedule") ||
      href.includes("calendly") ||
      href.includes("acuity") ||
      label.includes("book") ||
      label.includes("submit") ||
      label.includes("talent")
    );
  });

  const liveMusicMention =
    /live music|upcoming shows?|concert|open mic|book (a )?band|talent buyer|local acts?/i.test(
      text,
    );

  const servicesMention =
    liveMusicMention ||
    /shows?|events?|calendar|performers?|artists?|bands?/i.test(text) ||
    $("nav a, h1, h2").text().match(/shows?|events?|live music|calendar/i) !==
      null;

  const ecommerceHeavy =
    /add to cart|checkout|shop now|buy now/i.test(text) ||
    lowerHtml.includes("woocommerce") ||
    lowerHtml.includes("shopify");

  const extracted = extractContactsFromHtml($, html, pageUrl, pageKind);
  const contactPageUrl = findContactPageUrl($, pageUrl);

  return {
    text,
    contactLinks,
    bookingLinks,
    servicesMention,
    ecommerceHeavy,
    extracted,
    contactPageUrl,
    title: $("title").first().text().trim() || null,
    metaDescription:
      $('meta[name="description"]').attr("content")?.trim() || null,
  };
}

export async function runHtmlAudit(url: string): Promise<HtmlAuditResult> {
  const { isMockMode } = getEnv();

  if (isMockMode) {
    return getMockHtmlAudit(url);
  }

  const fetchUrl = url.startsWith("http") ? url : `https://${url}`;

  try {
    const homepage = await fetchHtml(fetchUrl);
    if (!homepage) {
      throw new Error("Failed to fetch homepage");
    }

    const homeUrl = homepage.finalUrl || fetchUrl;
    const home = analyzePage(homepage.html, homeUrl, "homepage");
    const pagesCrawled = [homeUrl];
    const extractions = [home.extracted];
    const pagesForLinkCheck: Array<{ url: string; html: string }> = [
      { url: homeUrl, html: homepage.html },
    ];

    if (home.contactPageUrl) {
      const contactPage = await fetchHtml(home.contactPageUrl);
      if (contactPage) {
        const contactUrl = contactPage.finalUrl || home.contactPageUrl;
        pagesCrawled.push(contactUrl);
        pagesForLinkCheck.push({ url: contactUrl, html: contactPage.html });
        const contact = analyzePage(contactPage.html, contactUrl, "contact");
        extractions.push(contact.extracted);
      }
    }

    const contacts = mergeContacts(extractions, pagesCrawled);
    const $home = cheerio.load(homepage.html);
    const combinedText = [home.text];
    if (home.contactPageUrl) {
      const contactPage = pagesForLinkCheck.find((p) =>
        p.url.includes("contact"),
      );
      if (contactPage) {
        combinedText.push(cheerio.load(contactPage.html)("body").text());
      }
    }
    const venueResearch = analyzeVenueResearch(
      combinedText.join("\n"),
      homepage.html,
      homeUrl,
    );
    const [brokenLinks, siteHealth] = await Promise.all([
      checkBrokenLinks(pagesForLinkCheck),
      Promise.resolve(analyzeSiteHealth($home)),
    ]);

    return {
      httpStatus: homepage.status,
      hasHttps:
        fetchUrl.startsWith("https://") ||
        homepage.finalUrl.startsWith("https://"),
      title: home.title,
      metaDescription: home.metaDescription,
      hasPhone: contacts.phones.length > 0 || PHONE_REGEX.test(home.text),
      hasContactLink: home.contactLinks.length > 0,
      hasServicesContent: Boolean(home.servicesMention),
      hasBookingLink:
        home.bookingLinks.length > 0 ||
        venueResearch.hasTalentBookingPage ||
        venueResearch.hasSubmissionForm,
      detectedBuilder: detectBuilder(homepage.html),
      ecommerceHeavy: home.ecommerceHeavy,
      brokenLinks,
      siteHealth,
      bestEmail: contacts.bestEmail,
      emailConfidence: contacts.emailConfidence,
      emailSource: contacts.emailSource,
      contacts,
      venueResearch,
    };
  } catch (error) {
    const empty = emptyContacts();
    return {
      httpStatus: null,
      hasHttps: fetchUrl.startsWith("https://"),
      title: null,
      metaDescription: null,
      hasPhone: false,
      hasContactLink: false,
      hasServicesContent: false,
      hasBookingLink: false,
      detectedBuilder: null,
      ecommerceHeavy: false,
      brokenLinks: emptyBrokenLinks(),
      siteHealth: emptySiteHealth(),
      bestEmail: null,
      emailConfidence: null,
      emailSource: null,
      contacts: empty,
      venueResearch: analyzeVenueResearch("", "", fetchUrl),
      failed: true,
      error: error instanceof Error ? error.message : "HTML audit failed",
    };
  }
}
