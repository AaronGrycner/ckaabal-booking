import type {
  Lead,
  LeadActivity,
  LeadStatus,
  ContactMethod,
  ReviewStatus,
  Outcome,
  SourceType,
  WebsiteAudit,
} from "@/lib/db/schema";
import { parseContactsJson } from "@/lib/parse-contacts-json";
import type { OutreachQualityReview } from "@/lib/services/outreach-email-generate";

export type BestContactMethod =
  | "email"
  | "contact_form"
  | "phone"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "website"
  | "none";

export type ContactAvailability = {
  hasEmail: boolean;
  hasPhone: boolean;
  hasContactForm: boolean;
  hasInstagram: boolean;
  hasFacebook: boolean;
  hasLinkedIn: boolean;
  bestContactMethod: BestContactMethod;
};

export type ReviewFilter = "all" | ReviewStatus;

export type CrmFilter =
  | "all"
  | "new"
  | "contacted"
  | "follow_up_due"
  | "replied"
  | "client"
  | "not_interested"
  | "not_fit"
  | "on_call_list";

export type PipelineCallListFilter = "all" | "on_list" | "not_on_list";

export type EmailClickFilter = "all" | "clicked" | "not_clicked";

const TERMINAL_STATUSES: LeadStatus[] = [
  "client",
  "not_interested",
  "not_fit",
];

const CONTACTED_STATUSES: LeadStatus[] = [
  "contacted",
  "follow_up_due",
  "replied",
  "meeting_scheduled",
  "proposal_sent",
];

const REPLIED_STATUSES: LeadStatus[] = [
  "replied",
  "meeting_scheduled",
  "proposal_sent",
  "client",
];

const LATER_PIPELINE_STATUSES: LeadStatus[] = [
  "replied",
  "meeting_scheduled",
  "proposal_sent",
  "client",
];

export function isLaterPipelineStatus(status: LeadStatus) {
  return LATER_PIPELINE_STATUSES.includes(status);
}

export function statusLabel(status: LeadStatus | string) {
  const labels: Record<string, string> = {
    new: "New",
    ready_to_contact: "Ready to contact",
    contacted: "Contacted",
    follow_up_due: "Follow up due",
    replied: "Replied",
    meeting_scheduled: "Hold / meeting",
    proposal_sent: "Offer sent",
    client: "Show booked",
    not_interested: "Not interested",
    not_fit: "Not fit",
    saved: "Ready to contact",
  };
  return labels[status] ?? status;
}

export function contactMethodLabel(method: string | null | undefined) {
  const labels: Record<string, string> = {
    email: "Email",
    contact_form: "Contact form",
    phone: "Phone",
    instagram: "Instagram",
    facebook: "Facebook",
    linkedin: "LinkedIn",
    in_person: "In person",
    other: "Other",
  };
  return method ? (labels[method] ?? method) : "—";
}

export function statusBadgeVariant(
  status: LeadStatus | string,
): "default" | "secondary" | "success" | "warning" | "danger" | "pending" {
  switch (status) {
    case "client":
      return "success";
    case "replied":
    case "meeting_scheduled":
    case "proposal_sent":
      return "default";
    case "follow_up_due":
      return "warning";
    case "contacted":
    case "ready_to_contact":
      return "secondary";
    case "not_interested":
    case "not_fit":
      return "danger";
    default:
      return "pending";
  }
}

function coerceDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatCrmDate(date: Date | string | null | undefined) {
  const value = coerceDate(date);
  if (!value) return "—";
  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatCrmDateTime(date: Date | string | null | undefined) {
  const value = coerceDate(date);
  if (!value) return "—";
  return value.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function matchesCrmFilter(lead: Lead, filter: CrmFilter) {
  if (filter === "all") return true;

  if (filter === "new") {
    return lead.status === "new" || lead.status === "ready_to_contact";
  }

  if (filter === "contacted") {
    return (
      CONTACTED_STATUSES.includes(lead.status as LeadStatus) ||
      lead.lastContactedAt != null
    );
  }

  if (filter === "follow_up_due") {
    return isFollowUpDueLead(lead);
  }

  if (filter === "replied") {
    return (
      REPLIED_STATUSES.includes(lead.status as LeadStatus) ||
      lead.replyReceivedAt != null
    );
  }

  if (filter === "client") {
    return lead.status === "client";
  }

  if (filter === "not_interested") {
    return lead.status === "not_interested";
  }

  if (filter === "not_fit") {
    return lead.status === "not_fit";
  }

  if (filter === "on_call_list") {
    return lead.onCallList;
  }

  return true;
}

export function matchesPipelineSearch(lead: Lead, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const fields = [
    lead.businessName,
    lead.category,
    lead.city,
    lead.address,
    lead.contactEmail,
    lead.phone,
    lead.notes,
    lead.sourceQuery,
  ];

  return fields.some((field) => field?.toLowerCase().includes(q));
}

export function matchesFitFilter(lead: Lead, fitFilter: string) {
  if (fitFilter === "all") return true;
  return lead.fitLabel === fitFilter;
}

export function matchesSourceFilter(lead: Lead, sourceFilter: string) {
  if (sourceFilter === "all") return true;
  return lead.sourceType === sourceFilter;
}

export function matchesCallListFilter(
  lead: Lead,
  filter: PipelineCallListFilter,
) {
  if (filter === "all") return true;
  if (filter === "on_list") return lead.onCallList;
  return !lead.onCallList;
}

export function matchesEmailClickFilter(lead: Lead, filter: EmailClickFilter) {
  if (filter === "all") return true;
  if (filter === "clicked") return lead.lastEmailClickedAt != null;
  return lead.lastEmailClickedAt == null;
}

export function hasEmailLinkClick(lead: Lead) {
  return lead.lastEmailClickedAt != null;
}

export const CRM_FILTERS: { id: CrmFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "new", label: "New / Ready" },
  { id: "contacted", label: "Contacted" },
  { id: "follow_up_due", label: "Follow Up Due" },
  { id: "replied", label: "Replied" },
  { id: "client", label: "Show booked" },
  { id: "not_interested", label: "Not interested" },
  { id: "not_fit", label: "Not fit" },
  { id: "on_call_list", label: "Call list" },
];

export const STATUS_GROUPS: { label: string; statuses: LeadStatus[] }[] = [
  {
    label: "Prospecting",
    statuses: ["new", "ready_to_contact"],
  },
  {
    label: "Active",
    statuses: [
      "contacted",
      "follow_up_due",
      "replied",
      "meeting_scheduled",
      "proposal_sent",
    ],
  },
  {
    label: "Won / Lost",
    statuses: ["client", "not_interested", "not_fit"],
  },
];

export function isContactMethod(value: string): value is ContactMethod {
  return [
    "email",
    "contact_form",
    "phone",
    "instagram",
    "facebook",
    "linkedin",
    "in_person",
    "other",
  ].includes(value);
}

export function getDuplicateOutreachWarning(lead: Lead): string | null {
  if (!lead.lastContactedAt) return null;
  const date = formatCrmDateTime(lead.lastContactedAt);
  const method = contactMethodLabel(lead.lastContactMethod);
  return `Already contacted on ${date} via ${method}. Review timeline before reaching out again.`;
}

export function getContactAvailability(
  lead: Lead,
  latestAudit?: WebsiteAudit | null,
): ContactAvailability {
  const contacts = parseContactsJson(latestAudit);
  const hasEmail = Boolean(lead.contactEmail?.trim());
  const hasPhone = Boolean(lead.phone?.trim());
  const hasContactForm = Boolean(latestAudit?.hasContactLink);
  const hasInstagram = Boolean(
    lead.instagramUrl?.trim() || contacts?.instagramUrl,
  );
  const hasFacebook = Boolean(
    lead.facebookUrl?.trim() || contacts?.facebookUrl,
  );
  const hasLinkedIn = Boolean(
    lead.linkedinUrl?.trim() || contacts?.linkedinUrl,
  );
  const hasWebsite = Boolean(lead.websiteUrl?.trim());

  let bestContactMethod: BestContactMethod = "none";
  if (hasEmail) bestContactMethod = "email";
  else if (hasContactForm) bestContactMethod = "contact_form";
  else if (hasInstagram) bestContactMethod = "instagram";
  else if (hasPhone) bestContactMethod = "phone";
  else if (hasFacebook) bestContactMethod = "facebook";
  else if (hasLinkedIn) bestContactMethod = "linkedin";
  else if (hasWebsite) bestContactMethod = "website";

  return {
    hasEmail,
    hasPhone,
    hasContactForm,
    hasInstagram,
    hasFacebook,
    hasLinkedIn,
    bestContactMethod,
  };
}

export function hasAnyContactMethod(availability: ContactAvailability) {
  return availability.bestContactMethod !== "none";
}

export function contactAvailabilityLabel(method: BestContactMethod | string) {
  const labels: Record<string, string> = {
    email: "Email",
    contact_form: "Contact form",
    phone: "Phone",
    instagram: "Instagram",
    facebook: "Facebook",
    linkedin: "LinkedIn",
    website: "Website",
    none: "None",
  };
  return labels[method] ?? method;
}

export function bestContactMethodToLogMethod(
  method: BestContactMethod,
): ContactMethod | null {
  switch (method) {
    case "email":
      return "email";
    case "contact_form":
      return "contact_form";
    case "phone":
      return "phone";
    case "instagram":
      return "instagram";
    case "facebook":
      return "facebook";
    case "linkedin":
      return "linkedin";
    case "website":
      return "other";
    default:
      return null;
  }
}

export function reviewStatusLabel(status: ReviewStatus | string) {
  const labels: Record<string, string> = {
    unreviewed: "Unreviewed",
    approved_for_outreach: "Approved",
    rejected: "Rejected",
  };
  return labels[status] ?? status;
}

export function reviewStatusBadgeVariant(
  status: ReviewStatus | string,
): "default" | "secondary" | "success" | "warning" | "danger" | "pending" {
  switch (status) {
    case "approved_for_outreach":
      return "success";
    case "rejected":
      return "danger";
    default:
      return "pending";
  }
}

export function outcomeLabel(outcome: Outcome | string) {
  const labels: Record<string, string> = {
    none: "None",
    no_response: "No response",
    positive_reply: "Positive reply",
    bad_fit: "Bad fit",
    too_expensive: "Too expensive",
    already_has_designer: "Books in-house only",
    meeting_booked: "Hold confirmed",
    closed_won: "Show confirmed",
    closed_lost: "Closed lost",
  };
  return labels[outcome] ?? outcome;
}

export function sourceTypeLabel(sourceType: SourceType | string) {
  const labels: Record<string, string> = {
    google_places: "Google Places",
    manual: "Manual",
    csv_import: "CSV import",
    instagram: "Instagram",
    facebook_group: "Facebook group",
    referral: "Referral",
    other: "Other",
  };
  return labels[sourceType] ?? sourceType;
}

export function isReadyLead(lead: Lead, availability: ContactAvailability) {
  if (lead.reviewStatus !== "approved_for_outreach") return false;
  if (lead.status !== "ready_to_contact" && lead.status !== "new") return false;
  if (lead.firstContactedAt != null) return false;
  if ((lead.fitScore ?? 0) < 60) return false;
  return hasAnyContactMethod(availability);
}

export function isFollowUpDueLead(lead: Lead) {
  if (TERMINAL_STATUSES.includes(lead.status as LeadStatus)) return false;
  if (!lead.followUpDueAt) return false;
  return lead.followUpDueAt.getTime() <= Date.now();
}

export function getDefaultFollowUpDays() {
  const raw = Number.parseInt(
    process.env.OUTREACH_DEFAULT_FOLLOW_UP_DAYS ?? "3",
    10,
  );
  if (Number.isNaN(raw) || raw < 1) return 3;
  return Math.min(raw, 365);
}

/** Returns days to schedule, or undefined to skip. Omitted values use the global default. */
export function resolveFollowUpDays(days?: number | null) {
  if (days === 0) return undefined;
  if (days != null && !Number.isNaN(days) && days > 0) {
    return Math.min(days, 365);
  }
  const defaultDays = getDefaultFollowUpDays();
  return defaultDays > 0 ? defaultDays : undefined;
}

export function getEffectiveLeadStatus(lead: Lead): LeadStatus {
  const status = lead.status as LeadStatus;

  if (TERMINAL_STATUSES.includes(status) || isLaterPipelineStatus(status)) {
    return status;
  }

  if (lead.followUpDueAt) {
    if (lead.followUpDueAt.getTime() <= Date.now()) {
      return "follow_up_due";
    }
    if (status === "follow_up_due") {
      return "contacted";
    }
  }

  return status;
}

export function followUpDueFieldLabel(lead: Lead) {
  if (!lead.followUpDueAt) return "Follow-up:";
  return isFollowUpDueLead(lead) ? "Follow-up due:" : "Follow-up scheduled:";
}

export function getLastMessageSent(
  activities: LeadActivity[],
): string | null {
  for (const activity of activities) {
    if (activity.activityType !== "contact_logged" || !activity.metadataJson) {
      continue;
    }
    try {
      const meta = JSON.parse(activity.metadataJson) as {
        messageSent?: string;
      };
      if (meta.messageSent?.trim()) return meta.messageSent.trim();
    } catch {
      continue;
    }
  }
  return null;
}

function parseOutreachGenerationMetadata(
  metadataJson: string | null,
  activityType: LeadActivity["activityType"],
): OutreachQualityReview | null {
  if (!metadataJson) return null;
  try {
    const meta = JSON.parse(metadataJson) as {
      type?: string;
      warnings?: string[];
      selectedIssue?: string | null;
      selectedAngle?: string | null;
      premiumPolish?: boolean;
      optionalInstruction?: string;
    };

    if (activityType === "outreach_email_premium_polished") {
      if (meta.type !== "outreach_email_premium_polished") return null;
      return {
        warnings: Array.isArray(meta.warnings) ? meta.warnings : [],
        selectedIssue: meta.selectedIssue ?? meta.selectedAngle ?? null,
        polished: true,
      };
    }

    if (meta.type !== "outreach_email_generated") return null;
    return {
      warnings: Array.isArray(meta.warnings) ? meta.warnings : [],
      selectedIssue: meta.selectedIssue ?? meta.selectedAngle ?? null,
      polished: Boolean(meta.premiumPolish),
    };
  } catch {
    return null;
  }
}

export function getLatestOutreachQualityReview(
  activities: LeadActivity[],
): OutreachQualityReview | null {
  for (const activity of activities) {
    if (
      activity.activityType !== "outreach_email_generated" &&
      activity.activityType !== "outreach_email_premium_polished"
    ) {
      continue;
    }
    const review = parseOutreachGenerationMetadata(
      activity.metadataJson,
      activity.activityType,
    );
    if (review) return review;
  }
  return null;
}

export function matchesReviewFilter(lead: Lead, filter: ReviewFilter) {
  if (filter === "all") return true;
  return lead.reviewStatus === filter;
}

export const REVIEW_FILTERS: { id: ReviewFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unreviewed", label: "Unreviewed" },
  { id: "approved_for_outreach", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

export const OUTCOMES: Outcome[] = [
  "none",
  "no_response",
  "positive_reply",
  "bad_fit",
  "too_expensive",
  "already_has_designer",
  "meeting_booked",
  "closed_won",
  "closed_lost",
];

export const SOURCE_TYPES: SourceType[] = [
  "google_places",
  "manual",
  "csv_import",
  "instagram",
  "facebook_group",
  "referral",
  "other",
];
