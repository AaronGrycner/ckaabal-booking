"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BulkDeleteLeadsButton } from "@/components/bulk-delete-leads-button";
import { CallListToggle } from "@/components/call-list-toggle";
import { ContactAvailabilityBadges } from "@/components/contact-availability-badges";
import { CrmStatusFilter } from "@/components/crm-status-filter";
import { DeleteLeadButton } from "@/components/delete-lead-button";
import { ReviewStatusFilter } from "@/components/review-status-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Lead, WebsiteAudit } from "@/lib/db/schema";
import {
  contactAvailabilityLabel,
  contactMethodLabel,
  formatCrmDate,
  getContactAvailability,
  matchesCallListFilter,
  matchesEmailClickFilter,
  hasEmailLinkClick,
  matchesCrmFilter,
  matchesFitFilter,
  matchesPipelineSearch,
  matchesReviewFilter,
  matchesSourceFilter,
  reviewStatusBadgeVariant,
  reviewStatusLabel,
  SOURCE_TYPES,
  sourceTypeLabel,
  statusBadgeVariant,
  statusLabel,
  getEffectiveLeadStatus,
  type CrmFilter,
  type EmailClickFilter,
  type PipelineCallListFilter,
  type ReviewFilter,
} from "@/lib/crm-utils";

type PipelineLeadRow = Lead & { latestAudit?: WebsiteAudit | null };

function fitBadgeVariant(label: string | null) {
  switch (label) {
    case "Excellent fit":
      return "success" as const;
    case "Good fit":
      return "default" as const;
    case "Maybe":
      return "warning" as const;
    default:
      return "secondary" as const;
  }
}

export function PipelineTable({ leads }: { leads: PipelineLeadRow[] }) {
  const [search, setSearch] = useState("");
  const [crmFilter, setCrmFilter] = useState<CrmFilter>("all");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [fitFilter, setFitFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [callListFilter, setCallListFilter] =
    useState<PipelineCallListFilter>("all");
  const [emailClickFilter, setEmailClickFilter] =
    useState<EmailClickFilter>("all");
  const [hideRejected, setHideRejected] = useState(true);
  const [hasPhoneOnly, setHasPhoneOnly] = useState(false);
  const [hasEmailOnly, setHasEmailOnly] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (!matchesPipelineSearch(lead, search)) return false;
      if (!matchesCrmFilter(lead, crmFilter)) return false;
      if (!matchesReviewFilter(lead, reviewFilter)) return false;
      if (!matchesFitFilter(lead, fitFilter)) return false;
      if (!matchesSourceFilter(lead, sourceFilter)) return false;
      if (!matchesCallListFilter(lead, callListFilter)) return false;
      if (!matchesEmailClickFilter(lead, emailClickFilter)) return false;
      if (hideRejected && reviewFilter === "all" && lead.reviewStatus === "rejected") {
        return false;
      }
      if (hasPhoneOnly && !lead.phone?.trim()) return false;
      if (hasEmailOnly && !lead.contactEmail?.trim()) return false;
      return true;
    });
  }, [
    leads,
    search,
    crmFilter,
    reviewFilter,
    fitFilter,
    sourceFilter,
    callListFilter,
    emailClickFilter,
    hideRejected,
    hasPhoneOnly,
    hasEmailOnly,
  ]);

  const selectedIds = useMemo(
    () => filteredLeads.filter((lead) => selected.has(lead.id)).map((l) => l.id),
    [filteredLeads, selected],
  );

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filteredLeads.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredLeads.map((lead) => lead.id)));
    }
  }

  function clearFilters() {
    setSearch("");
    setCrmFilter("all");
    setReviewFilter("all");
    setFitFilter("all");
    setSourceFilter("all");
    setCallListFilter("all");
    setEmailClickFilter("all");
    setHideRejected(true);
    setHasPhoneOnly(false);
    setHasEmailOnly(false);
    setSelected(new Set());
  }

  const filtersActive =
    search.trim().length > 0 ||
    crmFilter !== "all" ||
    reviewFilter !== "all" ||
    fitFilter !== "all" ||
    sourceFilter !== "all" ||
    callListFilter !== "all" ||
    emailClickFilter !== "all" ||
    !hideRejected ||
    hasPhoneOnly ||
    hasEmailOnly;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search business, email, phone, city, notes…"
          className="max-w-xl border-zinc-700 bg-zinc-900"
        />

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={fitFilter}
            onChange={(event) => setFitFilter(event.target.value)}
            className="h-9 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
          >
            <option value="all">All fit labels</option>
            <option value="Excellent fit">Excellent fit</option>
            <option value="Good fit">Good fit</option>
            <option value="Maybe">Maybe</option>
            <option value="Skip">Skip</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
            className="h-9 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
          >
            <option value="all">All sources</option>
            {SOURCE_TYPES.map((sourceType) => (
              <option key={sourceType} value={sourceType}>
                {sourceTypeLabel(sourceType)}
              </option>
            ))}
          </select>

          <select
            value={callListFilter}
            onChange={(event) =>
              setCallListFilter(event.target.value as PipelineCallListFilter)
            }
            className="h-9 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
          >
            <option value="all">All call list states</option>
            <option value="on_list">On call list</option>
            <option value="not_on_list">Not on call list</option>
          </select>

          <select
            value={emailClickFilter}
            onChange={(event) =>
              setEmailClickFilter(event.target.value as EmailClickFilter)
            }
            className="h-9 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
          >
            <option value="all">All email clicks</option>
            <option value="clicked">Clicked email link</option>
            <option value="not_clicked">Not clicked email link</option>
          </select>

          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={hideRejected}
              onChange={(event) => setHideRejected(event.target.checked)}
              className="rounded border-zinc-600"
            />
            Hide rejected
          </label>

          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={hasPhoneOnly}
              onChange={(event) => setHasPhoneOnly(event.target.checked)}
              className="rounded border-zinc-600"
            />
            Has phone
          </label>

          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={hasEmailOnly}
              onChange={(event) => setHasEmailOnly(event.target.checked)}
              className="rounded border-zinc-600"
            />
            Has email
          </label>

          {filtersActive && (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>

        <CrmStatusFilter value={crmFilter} onChange={setCrmFilter} />
        <ReviewStatusFilter value={reviewFilter} onChange={setReviewFilter} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          {filteredLeads.length} of {leads.length} leads
          {selected.size > 0 ? ` · ${selected.size} selected` : ""}
        </p>
        <BulkDeleteLeadsButton
          leadIds={selectedIds}
          disabled={selectedIds.length === 0}
          onDeleted={() => setSelected(new Set())}
        />
      </div>

      <div className="rounded-lg border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={
                    filteredLeads.length > 0 &&
                    selected.size === filteredLeads.length
                  }
                  onChange={toggleAll}
                />
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Review</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Best contact</TableHead>
              <TableHead>Contact Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Last Contact</TableHead>
              <TableHead>Follow Up Due</TableHead>
              <TableHead>Fit</TableHead>
              <TableHead>Call list</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.map((lead) => {
              const availability = getContactAvailability(
                lead,
                lead.latestAudit,
              );

              return (
                <TableRow key={lead.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.has(lead.id)}
                      onChange={() => toggle(lead.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(getEffectiveLeadStatus(lead))}>
                      {statusLabel(getEffectiveLeadStatus(lead))}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={reviewStatusBadgeVariant(lead.reviewStatus)}>
                      {reviewStatusLabel(lead.reviewStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Link href={`/leads/${lead.id}`}>{lead.businessName}</Link>
                      {hasEmailLinkClick(lead) && (
                        <Badge variant="success" className="text-[10px]">
                          Clicked
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-xs font-normal text-zinc-500">
                      {[lead.city, lead.category].filter(Boolean).join(" · ") ||
                        "—"}
                    </div>
                    <div className="mt-1">
                      <ContactAvailabilityBadges
                        lead={lead}
                        audit={lead.latestAudit}
                        showBest={false}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {sourceTypeLabel(lead.sourceType)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {contactAvailabilityLabel(availability.bestContactMethod)}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-sm">
                    {lead.contactEmail ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {lead.phone ? (
                      <a
                        href={`tel:${lead.phone.replace(/\D/g, "")}`}
                        className="text-sky-400 hover:text-sky-300"
                      >
                        {lead.phone}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{formatCrmDate(lead.lastContactedAt)}</div>
                    <div className="text-xs text-zinc-500">
                      {contactMethodLabel(lead.lastContactMethod)}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatCrmDate(lead.followUpDueAt)}
                  </TableCell>
                  <TableCell>
                    {lead.fitLabel ? (
                      <Badge variant={fitBadgeVariant(lead.fitLabel)}>
                        {lead.fitLabel}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <CallListToggle lead={lead} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/leads/${lead.id}`}>View</Link>
                      </Button>
                      <DeleteLeadButton
                        leadId={lead.id}
                        businessName={lead.businessName}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {!filteredLeads.length && (
              <TableRow>
                <TableCell colSpan={13} className="text-center text-zinc-500">
                  No leads match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
