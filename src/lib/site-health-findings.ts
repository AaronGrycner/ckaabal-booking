import type { WebsiteAudit } from "@/lib/db/schema";
import { getAuditIssues } from "@/lib/parse-audit-issues";

export type SiteFinding = {
  issue: string;
  whyItMatters: string;
};

export function buildSiteHealthFindings(
  audit: WebsiteAudit | null,
): SiteFinding[] {
  if (!audit) return [];

  const issues = getAuditIssues(audit);
  const findings: SiteFinding[] = [];

  const broken = issues?.brokenLinks;
  if (broken && broken.broken > 0) {
    const sample = broken.samples[0]?.url;
    findings.push({
      issue: `Broken internal links detected (${broken.broken} of ${broken.checked} checked)`,
      whyItMatters:
        "Dead links frustrate visitors and make the business look unmaintained, which can cost calls and bookings." +
        (sample ? ` Example: ${sample}` : ""),
    });
  }

  const health = issues?.siteHealth;
  if (!health) return findings;

  if (!health.hasViewportMeta) {
    findings.push({
      issue: "Missing mobile viewport meta tag",
      whyItMatters:
        "Without it, the site may not display properly on phones, where most local customers browse.",
    });
  }

  if (!health.hasH1) {
    findings.push({
      issue: "Missing H1 heading",
      whyItMatters:
        "A clear main heading helps visitors and search engines understand what the business offers.",
    });
  } else if (health.h1Count > 1) {
    findings.push({
      issue: "Multiple H1 headings on the homepage",
      whyItMatters:
        "Too many top-level headings can dilute the page message and hurt SEO clarity.",
    });
  }

  if (health.hasNoindex) {
    findings.push({
      issue: "Homepage blocked from search engines (noindex)",
      whyItMatters:
        "If the homepage tells Google not to index it, potential customers may never find the business in search.",
    });
  }

  if (health.imagesTotal > 0 && health.imagesMissingAlt > 0) {
    const ratio = health.imagesMissingAlt / health.imagesTotal;
    if (ratio >= 0.5 || health.imagesMissingAlt >= 3) {
      findings.push({
        issue: `Images missing alt text (${health.imagesMissingAlt} of ${health.imagesTotal})`,
        whyItMatters:
          "Missing alt text hurts accessibility and SEO, and can make the site feel less professional.",
      });
    }
  }

  if (health.thinContent) {
    findings.push({
      issue: `Thin homepage content (${health.wordCount} words)`,
      whyItMatters:
        "Very little copy gives visitors little reason to trust the business or understand what they should do next.",
    });
  }

  if (!health.hasOpenGraph) {
    findings.push({
      issue: "Missing Open Graph tags for social sharing",
      whyItMatters:
        "When the site is shared on social media, previews may look blank or unprofessional instead of selling the business.",
    });
  }

  if (!health.hasFavicon) {
    findings.push({
      issue: "Missing favicon",
      whyItMatters:
        "Small polish gaps like a missing tab icon can make an otherwise decent site feel unfinished.",
    });
  }

  const bestPractices = audit.bestPracticesScore;
  if (bestPractices != null && bestPractices < 70) {
    findings.push({
      issue: `Low Lighthouse best practices score (${bestPractices}/100)`,
      whyItMatters:
        "Best-practices issues often include security, browser compatibility, and UX problems that erode trust.",
    });
  }

  return findings;
}
