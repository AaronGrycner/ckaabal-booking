import type { Lead, LeadActivity, WebsiteAudit } from "@/lib/db/schema";
import { parseContactsJson } from "@/lib/parse-contacts-json";
import { getAuditIssues } from "@/lib/parse-audit-issues";
import {
  contactAvailabilityLabel,
  contactMethodLabel,
  formatCrmDate,
  formatCrmDateTime,
  getContactAvailability,
  getLastMessageSent,
  outcomeLabel,
  reviewStatusLabel,
  sourceTypeLabel,
  statusLabel,
  getEffectiveLeadStatus,
  followUpDueFieldLabel,
} from "@/lib/crm-utils";

function line(label: string, value: string | number | null | undefined) {
  if (value == null || value === "" || value === "—") return null;
  return `${label}: ${value}`;
}

function section(title: string, lines: Array<string | null>) {
  const content = lines.filter(Boolean) as string[];
  if (!content.length) return null;
  return [title, ...content, ""].join("\n");
}

export function formatLeadSummary(
  lead: Lead,
  audit?: WebsiteAudit | null,
  activities?: LeadActivity[],
) {
  const contacts = parseContactsJson(audit);
  const availability = getContactAvailability(lead, audit);
  const instagram =
    lead.instagramUrl?.trim() || contacts?.instagramUrl || null;
  const facebook = lead.facebookUrl?.trim() || contacts?.facebookUrl || null;
  const linkedin = lead.linkedinUrl?.trim() || contacts?.linkedinUrl || null;
  const lastMessage = activities?.length
    ? getLastMessageSent(activities)
    : null;
  const auditIssues = getAuditIssues(audit);

  const blocks = [
    "ckaabal VENUE SUMMARY",
    "=====================",
    "",
    section("VENUE", [
      line("Name", lead.businessName),
      line("Category", lead.category),
      line("City", lead.city),
      line("Address", lead.address),
      line("Rating", lead.rating ? `${lead.rating} (${lead.reviewCount ?? 0} reviews)` : null),
    ]),
    section("CONTACT", [
      line("Best method", contactAvailabilityLabel(availability.bestContactMethod)),
      line("Email", lead.contactEmail),
      lead.emailConfidence
        ? line("Email confidence", lead.emailConfidence)
        : null,
      lead.emailSource ? line("Email source", lead.emailSource) : null,
      line("Phone", lead.phone),
      line("Website", lead.websiteUrl),
      line("Instagram", instagram),
      line("Facebook", facebook),
      line("LinkedIn", linkedin),
      line("Google Maps", lead.mapsUrl),
    ]),
    section("FIT & OUTREACH", [
      lead.fitScore != null ? line("Fit score", lead.fitScore) : null,
      line("Fit label", lead.fitLabel),
      line("Top signal", lead.mainIssue),
      line("Research status", lead.auditStatus),
    ]),
    section("PIPELINE", [
      line("Review", reviewStatusLabel(lead.reviewStatus ?? "unreviewed")),
      lead.reviewedAt
        ? line("Reviewed at", formatCrmDateTime(lead.reviewedAt))
        : null,
      lead.rejectionReason
        ? line("Rejection reason", lead.rejectionReason)
        : null,
      line("Status", statusLabel(getEffectiveLeadStatus(lead))),
      lead.outcome && lead.outcome !== "none"
        ? line("Outcome", outcomeLabel(lead.outcome))
        : null,
      line("First contact", formatCrmDateTime(lead.firstContactedAt)),
      line("Last contact", formatCrmDateTime(lead.lastContactedAt)),
      line(followUpDueFieldLabel(lead).replace(/:$/, ""), formatCrmDate(lead.followUpDueAt)),
      line("Last method", contactMethodLabel(lead.lastContactMethod)),
      line("Reply received", formatCrmDateTime(lead.replyReceivedAt)),
    ]),
    section("SOURCE", [
      line("Type", sourceTypeLabel(lead.sourceType ?? "google_places")),
      line("Query", lead.sourceQuery),
      lead.sourceRunId != null ? line("Run ID", lead.sourceRunId) : null,
    ]),
    audit
      ? section("VENUE RESEARCH", [
          auditIssues?.venueResearch?.detectedGenres?.length
            ? line("Genres on site", auditIssues.venueResearch.detectedGenres.join(", "))
            : null,
          auditIssues?.venueResearch?.liveMusicSignals?.length
            ? line("Live music signals", auditIssues.venueResearch.liveMusicSignals.join("; "))
            : null,
          auditIssues?.venueResearch?.hasShowsCalendar
            ? line("Shows calendar", "Yes")
            : null,
          auditIssues?.venueResearch?.hasTalentBookingPage
            ? line("Talent booking page", "Yes")
            : null,
          auditIssues?.venueResearch?.submissionUrl
            ? line("Submission URL", auditIssues.venueResearch.submissionUrl)
            : null,
          line("Booker email on site", audit.hasContactLink ? "Contact path found" : "No"),
          line("Talent/booking link", audit.hasBookingLink ? "Yes" : "No"),
          line("Phone on site", audit.hasPhone ? "Yes" : "No"),
          line("Title", audit.title),
        ])
      : null,
    lead.notes?.trim()
      ? section("NOTES", [lead.notes.trim()])
      : null,
    lastMessage ? section("LAST MESSAGE SENT", [lastMessage]) : null,
    activities?.length
      ? section(
          "RECENT ACTIVITY",
          activities.slice(0, 5).map((a) => {
            const date = formatCrmDateTime(a.createdAt);
            const method = a.contactMethod
              ? ` · ${contactMethodLabel(a.contactMethod)}`
              : "";
            return `- ${date}${method}: ${a.summary}`;
          }),
        )
      : null,
  ].filter(Boolean);

  return blocks.join("\n").trim();
}
