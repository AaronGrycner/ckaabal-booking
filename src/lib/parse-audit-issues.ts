import type { WebsiteAudit } from "@/lib/db/schema";
import type { VenueResearch } from "@/lib/services/venue-research";

export type BrokenLinkSample = {
  url: string;
  status: number | null;
};

export type BrokenLinksReport = {
  checked: number;
  broken: number;
  samples: BrokenLinkSample[];
};

export type SiteHealthReport = {
  hasViewportMeta: boolean;
  hasH1: boolean;
  h1Count: number;
  imagesTotal: number;
  imagesMissingAlt: number;
  hasNoindex: boolean;
  hasFavicon: boolean;
  hasOpenGraph: boolean;
  wordCount: number;
  thinContent: boolean;
};

export type AuditIssuesJson = {
  pageSpeedFailed?: boolean;
  htmlFailed?: boolean;
  ecommerceHeavy?: boolean;
  pageSpeedError?: string;
  htmlError?: string;
  brokenLinks?: BrokenLinksReport;
  siteHealth?: SiteHealthReport;
  venueResearch?: VenueResearch;
};

export function parseAuditIssues(
  issuesJson: string | null | undefined,
): AuditIssuesJson | null {
  if (!issuesJson?.trim()) return null;

  try {
    return JSON.parse(issuesJson) as AuditIssuesJson;
  } catch {
    return null;
  }
}

export function getAuditIssues(audit: WebsiteAudit | null | undefined) {
  return parseAuditIssues(audit?.issuesJson);
}
