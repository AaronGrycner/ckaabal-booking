import type { Lead, LeadActivity, WebsiteAudit } from "@/lib/db/schema";
import { getLastMessageSent } from "@/lib/crm-utils";
import { getAuditIssues } from "@/lib/parse-audit-issues";
import { formatGenreList } from "@/lib/services/venue-research";
import OpenAI from "openai";

const DEFAULT_OUTREACH_MODEL = "gpt-5.4-mini";
const DEFAULT_PREMIUM_MODEL = "gpt-5.5";

const PREFLIGHT_ERROR_MESSAGE =
  "Not enough venue information to generate a booking pitch. Run a site research pass or add a note about the venue first.";

export type OutreachEmailDraft = {
  subject: string;
  body: string;
};

export type OutreachEmailResult = OutreachEmailDraft & {
  warnings: string[];
  selectedIssue: string | null;
  model: string;
  polished: boolean;
  rewriteAttempts: number;
};

export type OutreachQualityReview = {
  warnings: string[];
  selectedIssue: string | null;
  polished: boolean;
};

export type OutreachGenerationActivityMetadata = {
  type: "outreach_email_generated";
  model: string;
  selectedIssue: string;
  warnings: string[];
  emailType?: "cold" | "follow_up";
};

export type OutreachPremiumPolishActivityMetadata = {
  type: "outreach_email_premium_polished";
  model: string;
  selectedIssue: string;
  warnings: string[];
  optionalInstruction?: string;
};

export type CompressedOutreachContext = {
  businessName: string;
  mode: "cold" | "follow_up";
  websiteUrl?: string;
  selectedIssue: string;
  evidence?: string;
  whyItMatters: string;
  supportingDetail?: string;
  priorMessageSummary?: string;
  userInstruction?: string;
  senderIntro: string;
  signature: string;
};

export class OutreachGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutreachGenerationError";
  }
}

export type GenerateOutreachOptions = {
  optionalUserInstruction?: string;
  mode?: "cold" | "follow_up";
};

export type PremiumPolishOptions = {
  optionalUserInstruction?: string;
};

type WebsiteFinding = {
  issue: string;
  whyItMatters: string;
};

type AuditContext = {
  url: string | null;
  httpStatus: number | null;
  mobilePerformanceScore: number | null;
  seoScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  lcp: string | null;
  cls: string | null;
  hasHttps: boolean | null;
  hasContactLink: boolean | null;
  hasPhoneOnSite: boolean | null;
  hasServicesContent: boolean | null;
  hasBookingLink: boolean | null;
  hasTitle: boolean;
  hasMetaDescription: boolean;
  title: string | null;
  detectedBuilder: string | null;
};

type GenerationContext = {
  mode: "cold" | "follow_up";
  businessName: string;
  category: string | null;
  city: string | null;
  rating: string | null;
  reviewCount: number | null;
  websiteUrl: string | null;
  mainIssue: string | null;
  fitScore: number | null;
  fitLabel: string | null;
  contactEmail: string;
  userNotes: string | null;
  audit: AuditContext | null;
  contentChecklistFindings: WebsiteFinding[];
  websiteFindings: WebsiteFinding[];
  suggestedOutcomes: string[];
  previousMessage: string | null;
  signature: string;
  senderName: string | null;
  senderTitle: string | null;
  senderCompany: string | null;
};

type AngleCandidate = {
  priority: number;
  selectedIssue: string;
  evidence?: string;
  whyItMatters: string;
};

type DefaultEmailResult = {
  subject: string;
  body: string;
  warnings: string[];
};

export type OutreachModelConfig = {
  defaultModel: string;
  premiumModel: string;
  alwaysUseFinalReview: boolean;
  premiumPolishEnabled: boolean;
  maxRewriteAttempts: number;
  maxOutputTokens: number;
};

const GENERIC_NOTE_PATTERNS = [
  /good fit for us/i,
  /worth reaching out/i,
  /might book us/i,
  /seems like a fit/i,
];

const GENERIC_MAIN_ISSUES = new Set([
  "review manually",
  "active venue (many reviews)",
  "strong venue rating",
  "website listed",
]);

const FORBIDDEN_PHRASES = [
  "i hope this email finds you well",
  "i wanted to reach out",
  "i am reaching out",
  "we are the next big thing",
  "guaranteed to sell out",
  "you won't regret",
  "once in a lifetime",
  "huge following",
  "viral",
  "world class",
  "best band",
  "pay to play",
  "exposure",
  "pick your brain",
  "hop on a call",
  "book a call",
  "no obligation",
  "limited time",
  "in today's music industry",
  "i help bands like yours",
  "as a booking agent",
];

const FORBIDDEN_SUBJECT_PATTERNS = [
  /quick question/i,
  /booking inquiry/i,
  /amazing opportunity/i,
];

const COLD_CALL_PATTERNS = [
  /book a call/i,
  /hop on a call/i,
  /schedule a call/i,
  /jump on a call/i,
  /set up a meeting/i,
  /book a meeting/i,
  /let's meet/i,
  /lets meet/i,
];

const PRICING_PATTERNS = [
  /\$\d/,
  /\d+\s*dollars/i,
  /starting at \$/i,
  /pricing/i,
  /our packages/i,
  /website packages/i,
];

const AUDIT_REPORT_PATTERNS = [
  /lighthouse/i,
  /\d+\/100/,
  /\blcp\b/i,
  /\bcls\b/i,
  /seo score/i,
  /performance score/i,
  /accessibility score/i,
  /content checklist/i,
  /best practices score/i,
];

export function getOutreachModelConfig(): OutreachModelConfig {
  const shared = process.env.OPENAI_MODEL?.trim();

  const defaultModel =
    process.env.OPENAI_DEFAULT_OUTREACH_MODEL?.trim() ||
    process.env.OPENAI_DRAFT_MODEL?.trim() ||
    shared ||
    DEFAULT_OUTREACH_MODEL;

  const premiumModel =
    process.env.OPENAI_PREMIUM_REVIEW_MODEL?.trim() ||
    process.env.OPENAI_FINAL_MODEL?.trim() ||
    shared ||
    DEFAULT_PREMIUM_MODEL;

  const alwaysUseFinalReview =
    process.env.OPENAI_ALWAYS_USE_FINAL_REVIEW?.trim().toLowerCase() === "true";

  const premiumPolishEnabled =
    process.env.OPENAI_ENABLE_PREMIUM_POLISH?.trim().toLowerCase() !== "false";

  const maxRaw = Number.parseInt(
    process.env.OPENAI_MAX_REWRITE_ATTEMPTS ?? "1",
    10,
  );
  const maxRewriteAttempts = Number.isNaN(maxRaw) || maxRaw < 1 ? 1 : maxRaw;

  const tokensRaw = Number.parseInt(
    process.env.OPENAI_OUTREACH_MAX_OUTPUT_TOKENS ?? "500",
    10,
  );
  const maxOutputTokens = Number.isNaN(tokensRaw) || tokensRaw < 100 ? 500 : tokensRaw;

  return {
    defaultModel,
    premiumModel,
    alwaysUseFinalReview,
    premiumPolishEnabled,
    maxRewriteAttempts,
    maxOutputTokens,
  };
}

export function isPremiumPolishEnabled(): boolean {
  return getOutreachModelConfig().premiumPolishEnabled;
}

function getBandContext() {
  return {
    bandName:
      process.env.OUTREACH_BAND_NAME?.trim() ||
      process.env.OUTREACH_COMPANY_NAME?.trim() ||
      "ckaabal",
    bandGenre: process.env.OUTREACH_BAND_GENRE?.trim() || null,
    bandWebsite:
      process.env.OUTREACH_WEBSITE?.trim() ||
      process.env.PUBLIC_SITE_URL?.trim() ||
      "https://ckaabal.com",
    epkUrl:
      process.env.OUTREACH_EPK_URL?.trim() ||
      "https://drive.google.com/file/d/1IRY8dWYBz4xFwmZEPRFH3zmdNOnQfHez/view?usp=sharing",
  };
}

function buildSignatureBlock() {
  const custom = process.env.OUTREACH_SIGNATURE?.trim();
  if (custom) {
    return custom.replace(/\\n/g, "\n");
  }

  const { bandName, bandWebsite } = getBandContext();
  const name = process.env.OUTREACH_SENDER_NAME?.trim() || bandName;
  const title = process.env.OUTREACH_SENDER_TITLE?.trim();
  const tagline = process.env.OUTREACH_TAGLINE?.trim();
  const website = bandWebsite.replace(/^https?:\/\//, "");
  const email = process.env.OUTREACH_EMAIL?.trim();

  const lines = ["--"];
  if (name) lines.push(name);
  if (title) lines.push(title);
  if (tagline) lines.push(tagline);
  if (website || email) {
    lines.push("");
    if (website) lines.push(website);
    if (email) lines.push(email);
  }

  return lines.join("\n");
}

function buildSenderContext() {
  const { bandName } = getBandContext();
  const senderName = process.env.OUTREACH_SENDER_NAME?.trim() || bandName;
  const senderTitle = process.env.OUTREACH_SENDER_TITLE?.trim() || null;
  const senderCompany = bandName;

  return { senderName, senderTitle, senderCompany };
}

function isFollowUpLead(lead: Lead) {
  return Boolean(
    lead.firstContactedAt ||
      lead.status === "follow_up_due" ||
      lead.status === "contacted",
  );
}

function buildAuditContext(audit: WebsiteAudit | null): AuditContext | null {
  if (!audit) return null;

  return {
    url: audit.url,
    httpStatus: audit.httpStatus,
    mobilePerformanceScore: audit.mobilePerformanceScore,
    seoScore: audit.seoScore,
    accessibilityScore: audit.accessibilityScore,
    bestPracticesScore: audit.bestPracticesScore,
    lcp: audit.lcp,
    cls: audit.cls,
    hasHttps: audit.hasHttps,
    hasContactLink: audit.hasContactLink,
    hasPhoneOnSite: audit.hasPhone,
    hasServicesContent: audit.hasServicesContent,
    hasBookingLink: audit.hasBookingLink,
    hasTitle: Boolean(audit.title?.trim()),
    hasMetaDescription: Boolean(audit.metaDescription?.trim()),
    title: audit.title,
    detectedBuilder: audit.detectedBuilder,
  };
}

function buildVenueResearchFindings(
  audit: WebsiteAudit | null,
  lead: Pick<Lead, "contactEmail" | "websiteUrl" | "category" | "city">,
): WebsiteFinding[] {
  const findings: WebsiteFinding[] = [];
  const research = getAuditIssues(audit)?.venueResearch;

  if (lead.contactEmail?.trim()) {
    findings.push({
      issue: "Booker email on file",
      whyItMatters:
        "A direct booker email makes it easier to send a tailored pitch with dates and an EPK.",
    });
  }

  if (research?.detectedGenres.length) {
    const genres = formatGenreList(research.detectedGenres);
    findings.push({
      issue: genres ? `Venue books ${genres}` : "Genre signals on venue site",
      whyItMatters:
        "Mentioning the genres they already book shows you did your homework and fit their room.",
    });
  }

  if (research?.liveMusicSignals.length) {
    findings.push({
      issue: research.liveMusicSignals[0],
      whyItMatters:
        "Referencing their live music programming makes the pitch feel specific instead of a mass blast.",
    });
  }

  if (research?.hasShowsCalendar) {
    findings.push({
      issue: "Shows calendar on venue site",
      whyItMatters:
        "A public calendar helps you reference their booking rhythm and propose realistic dates.",
    });
  }

  if (research?.hasTalentBookingPage || research?.hasSubmissionForm) {
    findings.push({
      issue: "Talent submission process on site",
      whyItMatters:
        "Following their stated submission process increases the chance a booker actually reads your pitch.",
    });
  }

  if (audit?.hasBookingLink) {
    findings.push({
      issue: "Booking or talent link on site",
      whyItMatters:
        "Their site already signals they accept booking inquiries, which is a green light to reach out.",
    });
  }

  if (audit?.hasContactLink && !lead.contactEmail?.trim()) {
    findings.push({
      issue: "Contact form on venue site",
      whyItMatters:
        "Even without a booker email, a contact form gives you a path to start the conversation.",
    });
  }

  if (!lead.websiteUrl?.trim()) {
    findings.push({
      issue: "No venue website listed",
      whyItMatters:
        "Without a site it is harder to personalize, so lean on Google reviews, socials, or a phone call.",
    });
  } else if (
    audit &&
    !audit.hasContactLink &&
    !audit.hasBookingLink &&
    !lead.contactEmail?.trim()
  ) {
    findings.push({
      issue: "No clear booker contact path",
      whyItMatters:
        "You may need to call, DM, or dig for a talent buyer before sending a full pitch.",
    });
  }

  if (lead.city?.trim()) {
    findings.push({
      issue: `Routing through ${lead.city}`,
      whyItMatters:
        "Mentioning the market you are routing through helps bookers picture where you fit on a tour.",
    });
  }

  if (lead.category?.trim()) {
    findings.push({
      issue: `Venue type: ${lead.category}`,
      whyItMatters:
        "Framing your pitch for their room type (club, bar, theater) keeps the note relevant.",
    });
  }

  return findings;
}

function buildContentChecklistFindings(
  audit: WebsiteAudit | null,
): WebsiteFinding[] {
  return buildVenueResearchFindings(audit, {
    contactEmail: null,
    websiteUrl: audit?.url ?? null,
    category: null,
    city: null,
  });
}

function buildWebsiteFindings(
  audit: WebsiteAudit | null,
  lead: Pick<Lead, "websiteUrl" | "phone" | "contactEmail" | "category" | "city">,
): WebsiteFinding[] {
  return buildVenueResearchFindings(audit, lead);
}

function buildSuggestedOutcomes(category: string | null): string[] {
  const normalized = (category ?? "").toLowerCase();

  if (
    normalized.includes("festival") ||
    normalized.includes("amphitheatre") ||
    normalized.includes("amphitheater")
  ) {
    return ["festival slot inquiry", "routing date on a tour leg"];
  }

  if (
    normalized.includes("theater") ||
    normalized.includes("concert hall") ||
    normalized.includes("performing arts")
  ) {
    return ["headline or support slot", "weeknight or weekend date"];
  }

  if (normalized.includes("bar") || normalized.includes("brewery")) {
    return ["weeknight residency", "weekend slot with draw"];
  }

  if (normalized.includes("club") || normalized.includes("venue")) {
    return ["tour stop date", "support or co-bill opportunity"];
  }

  return ["tour routing date", "one-off show", "support slot"];
}

export function buildGenerationContext(
  lead: Lead,
  audit: WebsiteAudit | null,
  activities: LeadActivity[],
  options?: Pick<GenerateOutreachOptions, "mode">,
): GenerationContext {
  const previousMessage = getLastMessageSent(activities);
  const userNotes = lead.notes?.trim() || null;
  const sender = buildSenderContext();
  const mode =
    options?.mode ?? (isFollowUpLead(lead) ? "follow_up" : "cold");

  return {
    mode,
    businessName: lead.businessName,
    category: lead.category,
    city: lead.city,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    websiteUrl: lead.websiteUrl,
    mainIssue: lead.mainIssue,
    fitScore: lead.fitScore,
    fitLabel: lead.fitLabel,
    contactEmail: lead.contactEmail ?? "",
    userNotes,
    audit: buildAuditContext(audit),
    contentChecklistFindings: buildContentChecklistFindings(audit),
    websiteFindings: buildWebsiteFindings(audit, lead),
    suggestedOutcomes: buildSuggestedOutcomes(lead.category),
    previousMessage,
    signature: buildSignatureBlock(),
    ...sender,
  };
}

function hasConcreteUserNotes(notes: string | null): boolean {
  if (!notes?.trim()) return false;
  const trimmed = notes.trim();
  if (trimmed.length < 12) return false;
  return !GENERIC_NOTE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function hasMeaningfulMainIssue(mainIssue: string | null): boolean {
  if (!mainIssue?.trim()) return false;
  return !GENERIC_MAIN_ISSUES.has(mainIssue.trim().toLowerCase());
}

export function validateOutreachContext(context: GenerationContext): void {
  if (hasConcreteUserNotes(context.userNotes)) return;
  if (context.contentChecklistFindings.length > 0) return;
  if (context.websiteFindings.length > 0) return;
  if (hasMeaningfulMainIssue(context.mainIssue)) return;

  throw new OutreachGenerationError(PREFLIGHT_ERROR_MESSAGE);
}

function buildSenderIntroLine(
  context: Pick<GenerationContext, "senderName" | "senderCompany" | "businessName" | "city">,
): string {
  const { bandName, bandGenre } = getBandContext();
  const name = context.senderName?.trim() || bandName;
  const market = context.city?.trim();
  const genrePhrase = bandGenre ? ` (${bandGenre})` : "";
  if (market) {
    return `I'm ${name}${genrePhrase}, routing through ${market}, and I came across ${context.businessName} while researching venues in the area.`;
  }
  return `I'm ${name}${genrePhrase}, and I came across ${context.businessName} while researching venues for an upcoming tour.`;
}

function summarizePriorMessage(message: string | null): string | undefined {
  if (!message?.trim()) return undefined;
  const trimmed = message.trim();
  const lines = trimmed.split("\n");
  const subjectLine = lines[0]?.replace(/^Subject:\s*/i, "").trim() ?? "";
  const body = lines.slice(1).join(" ").trim();
  const firstSentence =
    body.match(/^[^.!?]+[.!?]/)?.[0]?.trim() ?? body.slice(0, 120).trim();
  const parts: string[] = [];
  if (subjectLine) parts.push(`Prior subject: ${subjectLine}`);
  if (firstSentence) parts.push(firstSentence);
  return parts.join(". ").slice(0, 280) || undefined;
}

function plainMobilePerformanceIssue(audit: AuditContext | null): AngleCandidate | null {
  const score = audit?.mobilePerformanceScore;
  if (score == null) return null;
  if (score < 50) {
    return {
      priority: 5,
      selectedIssue:
        "The homepage appears to take several seconds before the main content appears on mobile.",
      whyItMatters:
        "Most local customers browse on phones, and a slow first load can send them to a competitor before they see what you offer.",
    };
  }
  if (score < 70) {
    return {
      priority: 5.5,
      selectedIssue: "The homepage may load slowly on mobile phones.",
      whyItMatters:
        "Mobile speed affects whether visitors stick around long enough to call or book.",
    };
  }
  return null;
}

function classifyFindingPriority(issue: string): number {
  const lower = issue.toLowerCase();

  if (
    lower.includes("viewport") ||
    lower.includes("cut off") ||
    lower.includes("display") ||
    lower.includes("thin homepage content") ||
    lower.includes("multiple h1")
  ) {
    return 2;
  }

  if (
    lower.includes("contact link") ||
    lower.includes("booking link") ||
    lower.includes("no phone") ||
    lower.includes("phone number") ||
    lower.includes("broken internal link")
  ) {
    return 3;
  }

  if (
    lower.includes("http 200") ||
    lower.includes("https") ||
    lower.includes("noindex") ||
    lower.includes("missing mobile viewport")
  ) {
    return 4;
  }

  if (lower.includes("slow mobile") || lower.includes("mobile performance")) {
    return 5;
  }

  if (
    lower.includes("title tag") ||
    lower.includes("meta description") ||
    lower.includes("weak seo") ||
    lower.includes("missing h1")
  ) {
    return 6;
  }

  if (lower.includes("accessibility")) {
    return 7;
  }

  return 8;
}

function plainIssueFromFinding(issue: string): string {
  const lower = issue.toLowerCase();

  if (lower.includes("very slow mobile performance")) {
    return "The homepage appears to take several seconds before the main content appears on mobile.";
  }
  if (lower.includes("below-average mobile performance")) {
    return "The homepage may load slowly on mobile phones.";
  }
  if (lower.includes("weak seo score")) {
    return "Basic SEO setup looks weak, which can make the site harder to find in local search.";
  }
  if (lower.includes("accessibility gaps")) {
    return "Some parts of the site may be harder to use for visitors with accessibility needs.";
  }
  if (lower.includes("missing title tag")) {
    return "The homepage is missing a title tag.";
  }
  if (lower.includes("missing meta description")) {
    return "The homepage is missing a meta description.";
  }
  if (lower.includes("no clear contact link")) {
    return "There is no clear contact link on the homepage.";
  }
  if (lower.includes("no online booking link")) {
    return "There is no online booking link on the homepage.";
  }
  if (lower.includes("no phone number")) {
    return "A phone number is not easy to find on the homepage.";
  }
  if (lower.includes("does not use https")) {
    return "The site does not use HTTPS.";
  }
  if (lower.includes("does not return http 200")) {
    return "The homepage does not appear to load correctly.";
  }
  if (lower.includes("noindex")) {
    return "The homepage appears blocked from search engines.";
  }
  if (lower.includes("missing mobile viewport")) {
    return "The homepage may not display properly on mobile phones.";
  }
  if (lower.includes("broken internal link")) {
    return "Some internal links on the homepage appear broken.";
  }
  if (lower.includes("thin homepage content")) {
    return "The homepage has very little content for visitors to go on.";
  }
  if (lower.includes("missing h1")) {
    return "The homepage is missing a clear main heading.";
  }
  if (lower.includes("multiple h1")) {
    return "The homepage has more than one main heading, which can muddy the message.";
  }
  if (lower.includes("no website listed")) {
    return "No website is listed on the Google profile.";
  }

  return issue.replace(/^Content checklist:\s*/i, "").replace(/\(\d+\/100\)/g, "").trim();
}

function collectAngleCandidates(context: GenerationContext): AngleCandidate[] {
  const candidates: AngleCandidate[] = [];

  if (hasConcreteUserNotes(context.userNotes)) {
    candidates.push({
      priority: 1,
      selectedIssue: context.userNotes!.trim(),
      whyItMatters:
        "This is a specific observation worth mentioning in a personalized booking pitch.",
    });
  } else if (hasMeaningfulMainIssue(context.mainIssue)) {
    candidates.push({
      priority: 1.5,
      selectedIssue: context.mainIssue!.trim(),
      whyItMatters:
        "This signal stood out during venue research and is worth referencing in outreach.",
    });
  }

  for (const finding of [
    ...context.contentChecklistFindings,
    ...context.websiteFindings,
  ]) {
    const priority = classifyFindingPriority(finding.issue);
    candidates.push({
      priority,
      selectedIssue: plainIssueFromFinding(finding.issue),
      evidence: finding.issue.includes("(") ? undefined : finding.issue,
      whyItMatters: finding.whyItMatters,
    });
  }

  return candidates;
}

function pickBestSupportingDetail(
  context: GenerationContext,
  selectedIssue: string,
): string | undefined {
  const allFindings = [
    ...context.contentChecklistFindings,
    ...context.websiteFindings,
  ];
  for (const finding of allFindings) {
    const plain = plainIssueFromFinding(finding.issue);
    if (plain.toLowerCase() === selectedIssue.toLowerCase()) continue;
    return plain;
  }
  return undefined;
}

export function selectOutreachAngle(context: GenerationContext): CompressedOutreachContext {
  const candidates = collectAngleCandidates(context);
  candidates.sort((a, b) => a.priority - b.priority);
  const best = candidates[0];

  if (!best) {
    throw new OutreachGenerationError(PREFLIGHT_ERROR_MESSAGE);
  }

  const notesPrimary = hasConcreteUserNotes(context.userNotes);
  const compressed: CompressedOutreachContext = {
    businessName: context.businessName,
    mode: context.mode,
    websiteUrl: context.websiteUrl?.trim() || undefined,
    selectedIssue: best.selectedIssue,
    evidence: best.evidence,
    whyItMatters: best.whyItMatters,
    senderIntro: buildSenderIntroLine(context),
    signature: context.signature,
  };

  if (notesPrimary) {
    const supporting = pickBestSupportingDetail(context, best.selectedIssue);
    if (supporting) compressed.supportingDetail = supporting;
  }

  if (context.mode === "follow_up") {
    compressed.priorMessageSummary = summarizePriorMessage(context.previousMessage);
  }

  return compressed;
}

export function compressOutreachContext(
  context: GenerationContext,
  optionalInstruction?: string,
): CompressedOutreachContext {
  const compressed = selectOutreachAngle(context);
  if (optionalInstruction?.trim()) {
    compressed.userInstruction = optionalInstruction.trim();
  }
  return compressed;
}

const DEFAULT_GENERATION_SYSTEM_PROMPT = `You write short cold outreach emails for a touring band seeking live show bookings.

Rules:
- Write a short booking inquiry email to a venue booker or talent buyer.
- 90 to 130 words excluding signature.
- Include a brief human intro before the venue-specific hook.
- Preferred opening: "Hi," then a one-sentence intro using senderIntro from context.
- Reference the selected issue as a specific reason this venue is a fit (genres they book, live music programming, routing market, etc.).
- Do not sound like a mass blast or press release.
- Mention one hook only.
- Explain why it matters in one simple sentence.
- No guarantees about draw, ticket sales, or hype.
- No pay-to-play language.
- No call or meeting ask in first-touch cold emails.
- No fake praise or inflated claims.
- No corporate buzzwords.
- No em dashes.
- End with a soft CTA like "Would it be helpful if I sent over our EPK and a few routing dates?"
- Include the signature from context exactly as given.
- If no contact name is known, use "Hi,".

Forbidden phrases:
I hope this email finds you well; I wanted to reach out; guaranteed to sell out; world class; best band; pay to play; exposure; hop on a call; book a call; no obligation; limited time; in today's music industry; I help bands like yours; as a booking agent.

For follow_up mode: keep it shorter, reference priorMessageSummary briefly, and do not repeat the full cold pitch.

Return valid JSON only:
{"subject":"...","body":"...","warnings":[]}`;

function defaultGenerationUserPrompt(compressed: CompressedOutreachContext) {
  return `Write the outreach email using this context:\n${JSON.stringify(compressed)}`;
}

const PREMIUM_POLISH_SYSTEM_PROMPT = `You rewrite band booking outreach emails to sound more natural and human.

Goals:
- More natural human tone
- Less generic musician spam
- Stronger specificity using only facts in context
- Less hype
- Better brevity

Rules:
- Keep one main hook only.
- Keep the human intro before the venue-specific detail.
- No draw guarantees or pay-to-play language in cold first-touch emails.
- No em dashes.
- No forbidden phrases.
- Include the signature from context exactly as given.
- Do not invent facts.

Return valid JSON only:
{"subject":"...","body":"...","warnings":[]}`;

function premiumPolishUserPrompt(
  compressed: CompressedOutreachContext,
  draft: OutreachEmailDraft,
) {
  return `Rewrite this outreach email.

Current draft:
${JSON.stringify({ subject: draft.subject, body: draft.body })}

Context:
${JSON.stringify(compressed)}`;
}

function stripEmDashes(text: string) {
  return text.replace(/\u2014/g, "-").replace(/\u2013/g, "-");
}

function ensureSenderIntro(
  body: string,
  context: Pick<GenerationContext, "senderName" | "senderTitle" | "senderCompany">,
) {
  const name = context.senderName?.trim();
  if (!name) return body.trim();

  if (body.toLowerCase().includes(name.toLowerCase())) {
    return body.trim();
  }

  if (/^hi\b/i.test(body.trim())) {
    return body.trim();
  }

  const company = context.senderCompany ?? getBandContext().bandName;
  const intro = context.senderTitle?.trim()
    ? `I'm ${name}, ${context.senderTitle.trim()}.`
    : `I'm ${name} with ${company}.`;

  return `${intro}\n\n${body.trim()}`;
}

function ensureSignature(body: string, signature: string) {
  const trimmed = body.trim();
  if (!signature.trim()) return trimmed;

  const signatureName = process.env.OUTREACH_SENDER_NAME?.trim();
  if (signatureName && trimmed.toLowerCase().includes(signatureName.toLowerCase())) {
    return trimmed;
  }

  if (trimmed.includes(signature.trim())) {
    return trimmed;
  }

  return `${trimmed}\n\n${signature}`;
}

function applyPostProcessing(
  subject: string,
  body: string,
  context: GenerationContext,
) {
  return {
    subject: stripEmDashes(subject.trim()),
    body: ensureSignature(
      ensureSenderIntro(stripEmDashes(body.trim()), context),
      context.signature,
    ),
  };
}

function bodyWithoutSignature(body: string, signature: string) {
  const sig = signature.trim();
  if (!sig) return body.trim();
  if (body.includes(sig)) {
    return body.replace(sig, "").trim();
  }
  return body.trim();
}

function countSentences(text: string) {
  const matches = text.match(/[^.!?]+[.!?]+/g);
  return matches?.length ?? (text.trim() ? 1 : 0);
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function findForbiddenPhrases(text: string) {
  const lower = text.toLowerCase();
  return FORBIDDEN_PHRASES.filter((phrase) => lower.includes(phrase));
}

function soundsLikeAuditReport(text: string) {
  return AUDIT_REPORT_PATTERNS.some((pattern) => pattern.test(text));
}

function countRawMetrics(text: string) {
  const matches = text.match(/\d+\/100|\d+\.\d+\s*seconds?|\blcp\b|\bcls\b/gi);
  return matches?.length ?? 0;
}

function hasHumanIntroBeforeIssue(
  body: string,
  context: Pick<GenerationContext, "senderName" | "senderCompany">,
) {
  const mainBody = body.trim();
  if (!/^hi\b/i.test(mainBody)) return false;

  const introWindow = mainBody.slice(0, 280).toLowerCase();
  const name = context.senderName?.trim().toLowerCase();
  const company = context.senderCompany?.trim().toLowerCase();
  if (name && introWindow.includes(name)) return true;
  if (company && introWindow.includes(company)) return true;
  return introWindow.includes("i was looking at") || introWindow.includes("i'm ");
}

export function validateFinalEmail(
  subject: string,
  body: string,
  context: GenerationContext,
): { warnings: string[]; issues: string[] } {
  const warnings: string[] = [];
  const issues: string[] = [];

  const signature = context.signature;
  const mainBody = bodyWithoutSignature(body, signature);

  if (body.includes("\u2014") || body.includes("\u2013")) {
    issues.push("Body contains em dashes.");
  }

  const signatureName = process.env.OUTREACH_SENDER_NAME?.trim();
  const hasSignature =
    signature.trim().length > 0 &&
    (body.includes(signature.trim()) ||
      (signatureName && body.toLowerCase().includes(signatureName.toLowerCase())));
  if (!hasSignature && signature.trim()) {
    issues.push("Signature block is missing from the body.");
  }

  const forbiddenInBody = findForbiddenPhrases(mainBody);
  for (const phrase of forbiddenInBody) {
    issues.push(`Forbidden phrase in body: "${phrase}"`);
  }

  const forbiddenInSubject = findForbiddenPhrases(subject);
  for (const phrase of forbiddenInSubject) {
    issues.push(`Forbidden phrase in subject: "${phrase}"`);
  }

  for (const pattern of FORBIDDEN_SUBJECT_PATTERNS) {
    if (pattern.test(subject)) {
      issues.push(`Subject matches discouraged pattern: ${pattern.source}`);
    }
  }

  if (context.mode === "cold") {
    for (const pattern of COLD_CALL_PATTERNS) {
      if (pattern.test(mainBody)) {
        issues.push(`Cold email contains call/meeting language: ${pattern.source}`);
      }
    }
    for (const pattern of PRICING_PATTERNS) {
      if (pattern.test(mainBody)) {
        issues.push(`Cold email contains pricing language: ${pattern.source}`);
      }
    }
  }

  const sentenceCount = countSentences(mainBody);
  const maxSentences = context.mode === "follow_up" ? 8 : 10;
  const minSentences = context.mode === "follow_up" ? 3 : 4;
  if (sentenceCount > maxSentences) {
    warnings.push(`Body may be too long (${sentenceCount} sentences detected).`);
  }
  if (sentenceCount < minSentences) {
    warnings.push(`Body may be too short (${sentenceCount} sentences detected).`);
  }

  const wordCount = countWords(mainBody);
  if (context.mode === "cold" && wordCount > 150) {
    warnings.push(`Body may exceed target length (${wordCount} words).`);
  }

  if (soundsLikeAuditReport(mainBody)) {
    issues.push("Body sounds like an audit report.");
  }

  if (countRawMetrics(mainBody) >= 2) {
    issues.push("Body includes too many raw technical metrics.");
  }

  if (!hasHumanIntroBeforeIssue(body, context)) {
    issues.push("Body should start with a human intro before the issue.");
  }

  if (hasConcreteUserNotes(context.userNotes) === false && context.userNotes?.trim()) {
    warnings.push("Saved notes are vague; email may feel less personalized.");
  }

  return { warnings, issues };
}

function isBadValidation(issues: string[]) {
  if (issues.length === 0) return false;
  return issues.some((issue) => {
    const lower = issue.toLowerCase();
    return (
      lower.includes("forbidden phrase") ||
      lower.includes("call/meeting") ||
      lower.includes("pricing language") ||
      lower.includes("audit report") ||
      lower.includes("human intro") ||
      lower.includes("too many raw technical")
    );
  });
}

function applyLightValidationFixes(
  subject: string,
  body: string,
  context: GenerationContext,
  validation: { warnings: string[]; issues: string[] },
) {
  let nextSubject = subject;
  let nextBody = body;
  const warnings = [...validation.warnings];
  const issues = [...validation.issues];

  if (issues.some((issue) => issue.includes("em dashes"))) {
    nextSubject = stripEmDashes(nextSubject);
    nextBody = stripEmDashes(nextBody);
  }

  if (issues.some((issue) => issue.includes("Signature block is missing"))) {
    nextBody = ensureSignature(nextBody, context.signature);
  }

  const revalidated = validateFinalEmail(nextSubject, nextBody, context);
  return {
    subject: nextSubject,
    body: nextBody,
    warnings: [...warnings, ...revalidated.warnings],
    issues: revalidated.issues,
  };
}

function completionTokenParam(model: string, maxOutputTokens: number) {
  if (/gpt-5|^o[0-9]/i.test(model)) {
    return { max_completion_tokens: maxOutputTokens };
  }
  return { max_tokens: maxOutputTokens };
}

async function callOpenAIJson<T>(
  client: OpenAI,
  model: string,
  system: string,
  user: string,
  maxOutputTokens: number,
): Promise<T> {
  const completion = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    ...completionTokenParam(model, maxOutputTokens),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI returned an empty response.");
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("OpenAI returned invalid JSON.");
  }
}

export async function generateDefaultOutreachEmail(
  client: OpenAI,
  compressed: CompressedOutreachContext,
  model: string,
  maxOutputTokens: number,
): Promise<DefaultEmailResult> {
  const parsed = await callOpenAIJson<{
    subject?: string;
    body?: string;
    warnings?: string[];
  }>(
    client,
    model,
    DEFAULT_GENERATION_SYSTEM_PROMPT,
    defaultGenerationUserPrompt(compressed),
    maxOutputTokens,
  );

  const subject = parsed.subject?.trim() ?? "";
  const body = parsed.body?.trim() ?? "";
  if (!subject || !body) {
    throw new Error("Generated email is missing a subject or body.");
  }

  return {
    subject,
    body,
    warnings: Array.isArray(parsed.warnings)
      ? parsed.warnings.filter((w) => typeof w === "string" && w.trim())
      : [],
  };
}

async function polishWithPremiumModel(
  client: OpenAI,
  compressed: CompressedOutreachContext,
  draft: OutreachEmailDraft,
  model: string,
  maxOutputTokens: number,
): Promise<DefaultEmailResult> {
  const parsed = await callOpenAIJson<{
    subject?: string;
    body?: string;
    warnings?: string[];
  }>(
    client,
    model,
    PREMIUM_POLISH_SYSTEM_PROMPT,
    premiumPolishUserPrompt(compressed, draft),
    maxOutputTokens,
  );

  const subject = parsed.subject?.trim() ?? "";
  const body = parsed.body?.trim() ?? "";
  if (!subject || !body) {
    throw new Error("Premium polish is missing a subject or body.");
  }

  return {
    subject,
    body,
    warnings: Array.isArray(parsed.warnings)
      ? parsed.warnings.filter((w) => typeof w === "string" && w.trim())
      : [],
  };
}

async function generateWithValidationLoop(
  client: OpenAI,
  context: GenerationContext,
  compressed: CompressedOutreachContext,
  config: OutreachModelConfig,
  initialDraft?: OutreachEmailDraft,
): Promise<{
  subject: string;
  body: string;
  warnings: string[];
  model: string;
  polished: boolean;
  rewriteAttempts: number;
}> {
  let rewriteAttempts = 0;
  let modelUsed = config.defaultModel;
  let polished = false;
  const allWarnings: string[] = [];

  let generated: DefaultEmailResult;
  if (initialDraft) {
    generated = {
      subject: initialDraft.subject,
      body: initialDraft.body,
      warnings: [],
    };
  } else {
    generated = await generateDefaultOutreachEmail(
      client,
      compressed,
      config.defaultModel,
      config.maxOutputTokens,
    );
  }

  for (let attempt = 0; attempt <= config.maxRewriteAttempts; attempt++) {
    if (attempt > 0) {
      rewriteAttempts = attempt;
      generated = await generateDefaultOutreachEmail(
        client,
        compressed,
        config.defaultModel,
        config.maxOutputTokens,
      );
    }

    const processed = applyPostProcessing(generated.subject, generated.body, context);
    const validation = applyLightValidationFixes(
      processed.subject,
      processed.body,
      context,
      validateFinalEmail(processed.subject, processed.body, context),
    );

    allWarnings.push(...generated.warnings, ...validation.warnings);

    if (!isBadValidation(validation.issues)) {
      return {
        subject: validation.subject,
        body: validation.body,
        warnings: allWarnings,
        model: modelUsed,
        polished,
        rewriteAttempts,
      };
    }

    if (attempt >= config.maxRewriteAttempts) {
      if (config.alwaysUseFinalReview) {
        const premium = await polishWithPremiumModel(
          client,
          compressed,
          { subject: validation.subject, body: validation.body },
          config.premiumModel,
          config.maxOutputTokens,
        );
        modelUsed = config.premiumModel;
        polished = true;
        const premiumProcessed = applyPostProcessing(
          premium.subject,
          premium.body,
          context,
        );
        const premiumValidation = validateFinalEmail(
          premiumProcessed.subject,
          premiumProcessed.body,
          context,
        );
        allWarnings.push(...premium.warnings, ...premiumValidation.warnings);
        if (premiumValidation.issues.length) {
          allWarnings.push(
            "Email still has quality issues after premium polish. Review before sending.",
          );
        }
        return {
          subject: premiumProcessed.subject,
          body: premiumProcessed.body,
          warnings: allWarnings,
          model: modelUsed,
          polished,
          rewriteAttempts,
        };
      }

      allWarnings.push(
        "Email did not pass all quality checks. Review before sending.",
      );
      return {
        subject: validation.subject,
        body: validation.body,
        warnings: allWarnings,
        model: modelUsed,
        polished,
        rewriteAttempts,
      };
    }
  }

  throw new Error("Generation loop ended unexpectedly.");
}

export async function generateOutreachEmail(
  lead: Lead,
  audit: WebsiteAudit | null,
  activities: LeadActivity[],
  options: GenerateOutreachOptions = {},
): Promise<OutreachEmailResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const config = getOutreachModelConfig();
  const context = buildGenerationContext(lead, audit, activities, {
    mode: options.mode,
  });
  validateOutreachContext(context);

  const compressed = compressOutreachContext(
    context,
    options.optionalUserInstruction,
  );

  const client = new OpenAI({ apiKey });

  if (config.alwaysUseFinalReview) {
    const draft = await generateDefaultOutreachEmail(
      client,
      compressed,
      config.defaultModel,
      config.maxOutputTokens,
    );
    const premium = await polishWithPremiumModel(
      client,
      compressed,
      draft,
      config.premiumModel,
      config.maxOutputTokens,
    );
    const processed = applyPostProcessing(premium.subject, premium.body, context);
    const validation = validateFinalEmail(processed.subject, processed.body, context);
    const fixed = applyLightValidationFixes(
      processed.subject,
      processed.body,
      context,
      validation,
    );

    return {
      subject: fixed.subject,
      body: fixed.body,
      warnings: [...premium.warnings, ...fixed.warnings],
      selectedIssue: compressed.selectedIssue,
      model: config.premiumModel,
      polished: true,
      rewriteAttempts: 0,
    };
  }

  const result = await generateWithValidationLoop(client, context, compressed, config);

  return {
    subject: result.subject,
    body: result.body,
    warnings: result.warnings,
    selectedIssue: compressed.selectedIssue,
    model: result.model,
    polished: result.polished,
    rewriteAttempts: result.rewriteAttempts,
  };
}

export async function premiumPolishOutreachEmail(
  lead: Lead,
  audit: WebsiteAudit | null,
  activities: LeadActivity[],
  currentDraft: OutreachEmailDraft,
  options: PremiumPolishOptions = {},
): Promise<OutreachEmailResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const config = getOutreachModelConfig();
  if (!config.premiumPolishEnabled) {
    throw new Error("Premium polish is disabled.");
  }

  const context = buildGenerationContext(lead, audit, activities);
  validateOutreachContext(context);

  const compressed = compressOutreachContext(
    context,
    options.optionalUserInstruction,
  );

  const client = new OpenAI({ apiKey });
  const premium = await polishWithPremiumModel(
    client,
    compressed,
    currentDraft,
    config.premiumModel,
    config.maxOutputTokens,
  );

  const processed = applyPostProcessing(premium.subject, premium.body, context);
  const validation = applyLightValidationFixes(
    processed.subject,
    processed.body,
    context,
    validateFinalEmail(processed.subject, processed.body, context),
  );

  return {
    subject: validation.subject,
    body: validation.body,
    warnings: [...premium.warnings, ...validation.warnings],
    selectedIssue: compressed.selectedIssue,
    model: config.premiumModel,
    polished: true,
    rewriteAttempts: 0,
  };
}

export function toOutreachGenerationActivityMetadata(
  result: OutreachEmailResult,
  emailType?: "cold" | "follow_up",
): OutreachGenerationActivityMetadata {
  return {
    type: "outreach_email_generated",
    model: result.model,
    selectedIssue: result.selectedIssue ?? "Website improvement opportunity",
    warnings: result.warnings,
    emailType,
  };
}

export function toOutreachPremiumPolishActivityMetadata(
  result: OutreachEmailResult,
  optionalInstruction?: string,
): OutreachPremiumPolishActivityMetadata {
  return {
    type: "outreach_email_premium_polished",
    model: result.model,
    selectedIssue: result.selectedIssue ?? "Website improvement opportunity",
    warnings: result.warnings,
    optionalInstruction: optionalInstruction?.trim() || undefined,
  };
}

export function toOutreachQualityReview(
  result: OutreachEmailResult,
): OutreachQualityReview {
  return {
    warnings: result.warnings,
    selectedIssue: result.selectedIssue,
    polished: result.polished,
  };
}
