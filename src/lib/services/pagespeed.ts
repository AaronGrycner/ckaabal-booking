import { getEnv } from "@/lib/env";
import { getMockPageSpeed } from "./mock";

export type PageSpeedResult = {
  mobilePerformanceScore: number | null;
  seoScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  lcp: string | null;
  cls: string | null;
  tbt: string | null;
  rawSummaryJson?: string;
  failed?: boolean;
  error?: string;
};

function scoreFromCategory(
  categories: Record<string, { score?: number | null }> | undefined,
  key: string,
) {
  const raw = categories?.[key]?.score;
  if (raw == null) return null;
  return Math.round(raw * 100);
}

function metricDisplay(
  audits: Record<string, { displayValue?: string }> | undefined,
  id: string,
) {
  return audits?.[id]?.displayValue ?? null;
}

export async function runPageSpeedAudit(url: string): Promise<PageSpeedResult> {
  const { isMockMode, pageSpeedApiKey } = getEnv();

  if (isMockMode) {
    const mock = getMockPageSpeed(url);
    return { ...mock, rawSummaryJson: JSON.stringify(mock) };
  }

  const params = new URLSearchParams({
    url,
    strategy: "mobile",
    key: pageSpeedApiKey,
  });
  for (const cat of ["performance", "seo", "accessibility", "best-practices"]) {
    params.append("category", cat);
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`,
      { next: { revalidate: 0 } },
    );

    if (!response.ok) {
      return {
        mobilePerformanceScore: null,
        seoScore: null,
        accessibilityScore: null,
        bestPracticesScore: null,
        lcp: null,
        cls: null,
        tbt: null,
        failed: true,
        error: `PageSpeed API error (${response.status})`,
      };
    }

    const data = (await response.json()) as {
      lighthouseResult?: {
        categories?: Record<string, { score?: number | null }>;
        audits?: Record<string, { displayValue?: string }>;
      };
    };

    const categories = data.lighthouseResult?.categories;
    const audits = data.lighthouseResult?.audits;

    return {
      mobilePerformanceScore: scoreFromCategory(categories, "performance"),
      seoScore: scoreFromCategory(categories, "seo"),
      accessibilityScore: scoreFromCategory(categories, "accessibility"),
      bestPracticesScore: scoreFromCategory(categories, "best-practices"),
      lcp: metricDisplay(audits, "largest-contentful-paint"),
      cls: metricDisplay(audits, "cumulative-layout-shift"),
      tbt: metricDisplay(audits, "total-blocking-time"),
      rawSummaryJson: JSON.stringify({
        performance: scoreFromCategory(categories, "performance"),
        seo: scoreFromCategory(categories, "seo"),
      }),
    };
  } catch (error) {
    return {
      mobilePerformanceScore: null,
      seoScore: null,
      accessibilityScore: null,
      bestPracticesScore: null,
      lcp: null,
      cls: null,
      tbt: null,
      failed: true,
      error: error instanceof Error ? error.message : "PageSpeed failed",
    };
  }
}
