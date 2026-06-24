"use client";

import { CallListToggle } from "@/components/call-list-toggle";
import { LeadContactEmailForm } from "@/components/lead-contact-email-form";
import { LeadCrmPanel } from "@/components/lead-crm-panel";
import { LeadNotesPanel } from "@/components/lead-notes-panel";
import { LeadOutreachTrackingPanel } from "@/components/lead-outreach-tracking-panel";
import { OutreachEmailPanel } from "@/components/outreach-email-panel";
import { LeadReviewBar } from "@/components/lead-review-bar";
import { LeadOutcomeSelect } from "@/components/lead-outcome-select";
import { ContactAvailabilityBadges } from "@/components/contact-availability-badges";
import { CopyLeadSummaryButton } from "@/components/copy-lead-summary-button";
import { AuditPendingPoller } from "@/components/audit-pending-poller";
import { BusinessHoursDisplay } from "@/components/business-hours-display";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Lead, LeadActivity, TrackedOutreachLink, WebsiteAudit } from "@/lib/db/schema";
import type { ContactsData, ExtractedEmail } from "@/lib/services/contact-extract";
import { getAuditIssues } from "@/lib/parse-audit-issues";
import { getLatestOutreachQualityReview, sourceTypeLabel } from "@/lib/crm-utils";

function formatPhoneDisplay(phone: string) {
  const cleaned = phone.replace(/^tel:/i, "").trim();
  try {
    return decodeURIComponent(cleaned);
  } catch {
    return cleaned;
  }
}

function phoneTelHref(phone: string) {
  return `tel:${formatPhoneDisplay(phone).replace(/\D/g, "")}`;
}

function PhonesOnSite({ phones }: { phones: string[] }) {
  if (!phones.length) return <>—</>;

  return (
    <>
      {phones.map((phone, index) => {
        const display = formatPhoneDisplay(phone);
        return (
          <span key={`${display}-${index}`}>
            {index > 0 ? ", " : null}
            <a href={phoneTelHref(phone)}>{display}</a>
          </span>
        );
      })}
    </>
  );
}

function parseContactsJson(raw: string | null | undefined): ContactsData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ContactsData & {
      emails?: Array<string | ExtractedEmail>;
    };
    if (!parsed.emails?.length) return parsed;
    if (typeof parsed.emails[0] === "string") {
      return {
        ...parsed,
        emails: [],
        bestEmail: parsed.bestEmail ?? null,
        emailConfidence: parsed.emailConfidence ?? null,
        emailSource: parsed.emailSource ?? null,
      };
    }
    return parsed;
  } catch {
    return null;
  }
}

function CheckRow({ label, value }: { label: string; value: boolean | null | undefined }) {
  const ok = Boolean(value);
  return (
    <div className="flex items-center justify-between border-b border-zinc-800 py-2 text-sm">
      <span className="text-zinc-400">{label}</span>
      <span className={ok ? "text-emerald-400" : "text-red-400"}>
        {value == null ? "—" : ok ? "Yes" : "No"}
      </span>
    </div>
  );
}

export function LeadDetailClient({
  lead,
  audit,
  activities,
  gmailStatus,
  premiumPolishEnabled,
  defaultFollowUpDays,
  sendAttachmentsEnabled,
  sendAttachmentCount,
  signatureLink,
  trackedUrl,
}: {
  lead: Lead;
  audit: WebsiteAudit | null;
  activities: LeadActivity[];
  gmailStatus: { configured: boolean; email: string | null };
  premiumPolishEnabled: boolean;
  defaultFollowUpDays: number;
  sendAttachmentsEnabled: boolean;
  sendAttachmentCount: number;
  signatureLink: TrackedOutreachLink | null;
  trackedUrl: string | null;
}) {
  const pending = lead.auditStatus === "pending";
  const contacts = parseContactsJson(audit?.contactsJson);
  const auditIssues = getAuditIssues(audit);
  const venueResearch = auditIssues?.venueResearch;

  return (
    <div className="space-y-6">
      <AuditPendingPoller hasPending={pending} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{lead.businessName}</h1>
          <p className="text-zinc-400">{lead.category ?? "Venue"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lead.fitLabel && !pending && (
            <Badge variant="default">{lead.fitLabel}</Badge>
          )}
          <Badge variant="secondary">{lead.auditStatus}</Badge>
          <CallListToggle lead={lead} />
          <CopyLeadSummaryButton
            lead={lead}
            audit={audit}
            activities={activities}
          />
        </div>
      </div>

      <LeadReviewBar lead={lead} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        <LeadNotesPanel lead={lead} />
        <OutreachEmailPanel
          key={lead.id}
          lead={lead}
          initialSubject={lead.outreachDraftSubject ?? ""}
          initialBody={lead.outreachDraftBody ?? ""}
          initialQualityReview={getLatestOutreachQualityReview(activities)}
          gmailStatus={gmailStatus}
          premiumPolishEnabled={premiumPolishEnabled}
          defaultFollowUpDays={defaultFollowUpDays}
          sendAttachmentsEnabled={sendAttachmentsEnabled}
          sendAttachmentCount={sendAttachmentCount}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Venue info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-zinc-500">Address:</span>{" "}
              {lead.address ?? "—"}
            </p>
            <p>
              <span className="text-zinc-500">Phone:</span>{" "}
              {lead.phone ? (
                <a href={`tel:${lead.phone.replace(/\D/g, "")}`}>{lead.phone}</a>
              ) : (
                "—"
              )}
            </p>
            {lead.businessHours && (
              <div>
                <span className="text-zinc-500">Business hours:</span>
                <div className="mt-1">
                  <BusinessHoursDisplay hours={lead.businessHours} />
                </div>
              </div>
            )}
            <LeadContactEmailForm key={lead.id} lead={lead} />
            <p>
              <span className="text-zinc-500">Rating:</span> {lead.rating ?? "—"}{" "}
              ({lead.reviewCount ?? 0} reviews)
            </p>
            <p>
              <span className="text-zinc-500">Website:</span>{" "}
              {lead.websiteUrl ? (
                <a href={lead.websiteUrl} target="_blank" rel="noopener noreferrer">
                  {lead.websiteUrl}
                </a>
              ) : (
                "None listed"
              )}
            </p>
            <p>
              <span className="text-zinc-500">Maps:</span>{" "}
              {lead.mapsUrl ? (
                <a href={lead.mapsUrl} target="_blank" rel="noopener noreferrer">
                  View on Google Maps
                </a>
              ) : (
                "—"
              )}
            </p>
            {!pending && (
              <>
                <p>
                  <span className="text-zinc-500">Fit score:</span>{" "}
                  {lead.fitScore ?? "—"}
                </p>
                <p>
                  <span className="text-zinc-500">Top signal:</span>{" "}
                  {lead.mainIssue ?? "—"}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Venue research</CardTitle>
        </CardHeader>
        <CardContent>
          {pending ? (
            <p className="text-sm text-zinc-400">
              Contact and genre research running in the background…
            </p>
          ) : audit ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-medium text-zinc-300">
                  Booking signals
                </h3>
                <CheckRow
                  label="Live music on site"
                  value={Boolean(venueResearch?.liveMusicSignals.length)}
                />
                <CheckRow
                  label="Shows calendar"
                  value={venueResearch?.hasShowsCalendar}
                />
                <CheckRow
                  label="Talent booking page"
                  value={venueResearch?.hasTalentBookingPage}
                />
                <CheckRow
                  label="Submission form"
                  value={venueResearch?.hasSubmissionForm}
                />
                <CheckRow label="Talent/booking link" value={audit.hasBookingLink} />
                <CheckRow label="Contact path" value={audit.hasContactLink} />
                <CheckRow label="Phone on site" value={audit.hasPhone} />
                {venueResearch?.detectedGenres?.length ? (
                  <p className="mt-3 text-sm">
                    <span className="text-zinc-500">Genres detected:</span>{" "}
                    {venueResearch.detectedGenres.join(", ")}
                  </p>
                ) : null}
                {venueResearch?.liveMusicSignals?.length ? (
                  <p className="mt-2 text-sm">
                    <span className="text-zinc-500">Signals:</span>{" "}
                    {venueResearch.liveMusicSignals.join("; ")}
                  </p>
                ) : null}
                {venueResearch?.submissionUrl ? (
                  <p className="mt-2 text-sm">
                    <span className="text-zinc-500">Submission URL:</span>{" "}
                    <a
                      href={venueResearch.submissionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {venueResearch.submissionUrl}
                    </a>
                  </p>
                ) : null}
              </div>
              {contacts && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-zinc-300">
                    Extracted contacts
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-zinc-500">Emails:</span>
                      {contacts.emails.length ? (
                        <ul className="mt-1 space-y-1">
                          {contacts.emails.map((entry) => (
                            <li key={`${entry.email}-${entry.source}`}>
                              {entry.email}{" "}
                              <span className="text-zinc-500">
                                — {entry.confidence} ({entry.source})
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="ml-1">—</span>
                      )}
                    </div>
                    <div className="text-sm">
                      <span className="text-zinc-500">Phones on site:</span>{" "}
                      <PhonesOnSite phones={contacts.phones} />
                    </div>
                    <p>
                      <span className="text-zinc-500">Instagram:</span>{" "}
                      {contacts.instagramUrl ? (
                        <a
                          href={contacts.instagramUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {contacts.instagramUrl}
                        </a>
                      ) : (
                        "—"
                      )}
                    </p>
                    <p>
                      <span className="text-zinc-500">Facebook:</span>{" "}
                      {contacts.facebookUrl ? (
                        <a
                          href={contacts.facebookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {contacts.facebookUrl}
                        </a>
                      ) : (
                        "—"
                      )}
                    </p>
                    <p>
                      <span className="text-zinc-500">LinkedIn:</span>{" "}
                      {contacts.linkedinUrl ? (
                        <a
                          href={contacts.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {contacts.linkedinUrl}
                        </a>
                      ) : (
                        "—"
                      )}
                    </p>
                    {contacts.pagesCrawled.length > 0 && (
                      <p className="text-xs text-zinc-500">
                        Pages crawled: {contacts.pagesCrawled.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">
          No website to research, or research failed.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact availability</CardTitle>
          </CardHeader>
          <CardContent>
            <ContactAvailabilityBadges lead={lead} audit={audit} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-zinc-500">Type:</span>{" "}
              {sourceTypeLabel(lead.sourceType)}
            </p>
            <p>
              <span className="text-zinc-500">Query:</span>{" "}
              {lead.sourceQuery}
            </p>
            {lead.sourceRunId != null && (
              <p>
                <span className="text-zinc-500">Run ID:</span> {lead.sourceRunId}
              </p>
            )}
          </CardContent>
        </Card>
        <LeadOutcomeSelect lead={lead} />
      </div>

      <LeadCrmPanel
        lead={lead}
        activities={activities}
        defaultFollowUpDays={defaultFollowUpDays}
      />

      <LeadOutreachTrackingPanel
        lead={lead}
        signatureLink={signatureLink}
        trackedUrl={trackedUrl}
      />
    </div>
  );
}
