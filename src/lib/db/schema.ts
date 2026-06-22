import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const auditStatuses = [
  "pending",
  "complete",
  "failed",
  "skipped",
] as const;
export type AuditStatus = (typeof auditStatuses)[number];

export const leadStatuses = [
  "new",
  "ready_to_contact",
  "contacted",
  "follow_up_due",
  "replied",
  "meeting_scheduled",
  "proposal_sent",
  "client",
  "not_interested",
  "not_fit",
] as const;
export type LeadStatus = (typeof leadStatuses)[number];

export const activityTypes = [
  "status_change",
  "contact_logged",
  "follow_up_scheduled",
  "reply_received",
  "note_added",
  "review_changed",
  "outcome_changed",
  "outreach_email_generated",
  "outreach_email_premium_polished",
  "outreach_link_clicked",
] as const;
export type ActivityType = (typeof activityTypes)[number];

export const reviewStatuses = [
  "unreviewed",
  "approved_for_outreach",
  "rejected",
] as const;
export type ReviewStatus = (typeof reviewStatuses)[number];

export const outcomes = [
  "none",
  "no_response",
  "positive_reply",
  "bad_fit",
  "too_expensive",
  "already_has_designer",
  "meeting_booked",
  "closed_won",
  "closed_lost",
] as const;
export type Outcome = (typeof outcomes)[number];

export const sourceTypes = [
  "google_places",
  "manual",
  "csv_import",
  "instagram",
  "facebook_group",
  "referral",
  "other",
] as const;
export type SourceType = (typeof sourceTypes)[number];

export const contactMethods = [
  "email",
  "contact_form",
  "phone",
  "instagram",
  "facebook",
  "linkedin",
  "in_person",
  "other",
] as const;
export type ContactMethod = (typeof contactMethods)[number];

export const fitLabels = [
  "Excellent fit",
  "Good fit",
  "Maybe",
  "Skip",
] as const;
export type FitLabel = (typeof fitLabels)[number];

export const outreachLinkTypes = ["signature"] as const;
export type OutreachLinkType = (typeof outreachLinkTypes)[number];

export const searchRuns = sqliteTable("search_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  query: text("query").notNull(),
  location: text("location").notNull(),
  maxResults: integer("max_results").notNull(),
  totalFound: integer("total_found").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const leads = sqliteTable("leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  searchRunId: integer("search_run_id").references(() => searchRuns.id, {
    onDelete: "cascade",
  }),
  businessName: text("business_name").notNull(),
  category: text("category"),
  address: text("address"),
  city: text("city"),
  phone: text("phone"),
  contactEmail: text("contact_email"),
  emailConfidence: text("email_confidence"),
  emailSource: text("email_source"),
  websiteUrl: text("website_url"),
  mapsUrl: text("maps_url"),
  rating: text("rating"),
  reviewCount: integer("review_count"),
  sourceQuery: text("source_query").notNull(),
  sourceType: text("source_type", { enum: sourceTypes })
    .notNull()
    .default("google_places"),
  sourceRunId: integer("source_run_id"),
  reviewStatus: text("review_status", { enum: reviewStatuses })
    .notNull()
    .default("unreviewed"),
  reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
  rejectionReason: text("rejection_reason"),
  outcome: text("outcome", { enum: outcomes }).notNull().default("none"),
  instagramUrl: text("instagram_url"),
  facebookUrl: text("facebook_url"),
  linkedinUrl: text("linkedin_url"),
  status: text("status", { enum: leadStatuses }).notNull().default("new"),
  auditStatus: text("audit_status", { enum: auditStatuses })
    .notNull()
    .default("pending"),
  fitScore: integer("fit_score"),
  fitLabel: text("fit_label", { enum: fitLabels }),
  mainIssue: text("main_issue"),
  notes: text("notes"),
  firstContactedAt: integer("first_contacted_at", { mode: "timestamp_ms" }),
  lastContactedAt: integer("last_contacted_at", { mode: "timestamp_ms" }),
  followUpDueAt: integer("follow_up_due_at", { mode: "timestamp_ms" }),
  lastContactMethod: text("last_contact_method"),
  replyReceivedAt: integer("reply_received_at", { mode: "timestamp_ms" }),
  lastEmailClickedAt: integer("last_email_clicked_at", { mode: "timestamp_ms" }),
  emailClickCount: integer("email_click_count").notNull().default(0),
  outreachDraftSubject: text("outreach_draft_subject"),
  outreachDraftBody: text("outreach_draft_body"),
  outreachDraftUpdatedAt: integer("outreach_draft_updated_at", {
    mode: "timestamp_ms",
  }),
  onCallList: integer("on_call_list", { mode: "boolean" })
    .notNull()
    .default(false),
  callListAddedAt: integer("call_list_added_at", { mode: "timestamp_ms" }),
  businessHours: text("business_hours"),
  dedupeKey: text("dedupe_key").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const leadActivities = sqliteTable("lead_activities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadId: integer("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  activityType: text("activity_type", { enum: activityTypes }).notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  contactMethod: text("contact_method"),
  summary: text("summary").notNull(),
  metadataJson: text("metadata_json"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const gmailCredentials = sqliteTable("gmail_credentials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const trackedOutreachLinks = sqliteTable("tracked_outreach_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull().unique(),
  leadId: integer("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  destinationUrl: text("destination_url").notNull(),
  linkType: text("link_type", { enum: outreachLinkTypes })
    .notNull()
    .default("signature"),
  campaign: text("campaign"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  lastClickedAt: integer("last_clicked_at", { mode: "timestamp_ms" }),
  clickCount: integer("click_count").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const outreachLinkClicks = sqliteTable("outreach_link_clicks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trackedLinkId: integer("tracked_link_id")
    .notNull()
    .references(() => trackedOutreachLinks.id, { onDelete: "cascade" }),
  leadId: integer("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  clickedAt: integer("clicked_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  ipHash: text("ip_hash"),
  country: text("country"),
  city: text("city"),
});

export const websiteAudits = sqliteTable("website_audits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadId: integer("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  httpStatus: integer("http_status"),
  hasHttps: integer("has_https", { mode: "boolean" }),
  title: text("title"),
  metaDescription: text("meta_description"),
  mobilePerformanceScore: integer("mobile_performance_score"),
  seoScore: integer("seo_score"),
  accessibilityScore: integer("accessibility_score"),
  bestPracticesScore: integer("best_practices_score"),
  lcp: text("lcp"),
  cls: text("cls"),
  tbt: text("tbt"),
  hasPhone: integer("has_phone", { mode: "boolean" }),
  hasContactLink: integer("has_contact_link", { mode: "boolean" }),
  hasServicesContent: integer("has_services_content", { mode: "boolean" }),
  hasBookingLink: integer("has_booking_link", { mode: "boolean" }),
  detectedBuilder: text("detected_builder"),
  contactsJson: text("contacts_json"),
  issuesJson: text("issues_json"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const searchRunsRelations = relations(searchRuns, ({ many }) => ({
  leads: many(leads),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  searchRun: one(searchRuns, {
    fields: [leads.searchRunId],
    references: [searchRuns.id],
  }),
  websiteAudits: many(websiteAudits),
  activities: many(leadActivities),
  trackedOutreachLinks: many(trackedOutreachLinks),
}));

export const trackedOutreachLinksRelations = relations(
  trackedOutreachLinks,
  ({ one, many }) => ({
    lead: one(leads, {
      fields: [trackedOutreachLinks.leadId],
      references: [leads.id],
    }),
    clicks: many(outreachLinkClicks),
  }),
);

export const outreachLinkClicksRelations = relations(
  outreachLinkClicks,
  ({ one }) => ({
    trackedLink: one(trackedOutreachLinks, {
      fields: [outreachLinkClicks.trackedLinkId],
      references: [trackedOutreachLinks.id],
    }),
    lead: one(leads, {
      fields: [outreachLinkClicks.leadId],
      references: [leads.id],
    }),
  }),
);

export const leadActivitiesRelations = relations(leadActivities, ({ one }) => ({
  lead: one(leads, {
    fields: [leadActivities.leadId],
    references: [leads.id],
  }),
}));

export const websiteAuditsRelations = relations(websiteAudits, ({ one }) => ({
  lead: one(leads, {
    fields: [websiteAudits.leadId],
    references: [leads.id],
  }),
}));

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadActivity = typeof leadActivities.$inferSelect;
export type WebsiteAudit = typeof websiteAudits.$inferSelect;
export type SearchRun = typeof searchRuns.$inferSelect;
export type GmailCredential = typeof gmailCredentials.$inferSelect;
export type TrackedOutreachLink = typeof trackedOutreachLinks.$inferSelect;
export type OutreachLinkClick = typeof outreachLinkClicks.$inferSelect;
