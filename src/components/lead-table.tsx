"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { updateLeadStatusAction, updateReviewStatusAction } from "@/actions/leads";
import { CrmStatusFilter } from "@/components/crm-status-filter";
import { ContactAvailabilityBadges } from "@/components/contact-availability-badges";
import { ReviewStatusFilter } from "@/components/review-status-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  matchesCrmFilter,
  matchesReviewFilter,
  reviewStatusBadgeVariant,
  reviewStatusLabel,
  statusBadgeVariant,
  statusLabel,
  getEffectiveLeadStatus,
  type CrmFilter,
  type ReviewFilter,
} from "@/lib/crm-utils";

type LeadWithAudit = Lead & { latestAudit?: WebsiteAudit | null };

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

function AuditPendingBadge() {
  return <Badge variant="pending">Audit Pending</Badge>;
}

export function LeadTable({
  leads: initialLeads,
  runId,
}: {
  leads: LeadWithAudit[];
  runId: number;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [noWebsiteOnly, setNoWebsiteOnly] = useState(false);
  const [fitFilter, setFitFilter] = useState<string>("all");
  const [crmFilter, setCrmFilter] = useState<CrmFilter>("all");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");

  const sortedLeads = useMemo(() => {
    let rows = [...initialLeads];

    if (noWebsiteOnly) {
      rows = rows.filter((l) => !l.websiteUrl);
    }

    if (fitFilter !== "all") {
      rows = rows.filter((l) => l.fitLabel === fitFilter);
    }

    if (crmFilter !== "all") {
      rows = rows.filter((l) => matchesCrmFilter(l, crmFilter));
    }

    if (reviewFilter !== "all") {
      rows = rows.filter((l) => matchesReviewFilter(l, reviewFilter));
    }

    rows.sort((a, b) => {
      const aPending = a.auditStatus === "pending" ? 1 : 0;
      const bPending = b.auditStatus === "pending" ? 1 : 0;
      if (aPending !== bPending) return aPending - bPending;
      return (b.fitScore ?? -1) - (a.fitScore ?? -1);
    });

    return rows;
  }, [initialLeads, noWebsiteOnly, fitFilter, crmFilter, reviewFilter]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === sortedLeads.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sortedLeads.map((l) => l.id)));
    }
  }

  const exportUrl =
    selected.size > 0
      ? `/api/export/csv?ids=${[...selected].join(",")}`
      : `/api/export/csv?runId=${runId}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={noWebsiteOnly}
            onChange={(e) => setNoWebsiteOnly(e.target.checked)}
            className="rounded border-zinc-600"
          />
          No website only
        </label>
        <select
          value={fitFilter}
          onChange={(e) => setFitFilter(e.target.value)}
          className="h-9 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
        >
          <option value="all">All fit labels</option>
          <option value="Excellent fit">Excellent fit</option>
          <option value="Good fit">Good fit</option>
          <option value="Maybe">Maybe</option>
          <option value="Skip">Skip</option>
        </select>
        <Button variant="secondary" size="sm" asChild>
          <a href={exportUrl}>Export CSV</a>
        </Button>
        <span className="text-xs text-zinc-500">
          {sortedLeads.length} leads · sorted by fit (pending at bottom)
        </span>
      </div>

      <CrmStatusFilter value={crmFilter} onChange={setCrmFilter} />
      <ReviewStatusFilter value={reviewFilter} onChange={setReviewFilter} />

      <div className="rounded-lg border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={
                    sortedLeads.length > 0 &&
                    selected.size === sortedLeads.length
                  }
                  onChange={toggleAll}
                />
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Review</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Fit</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Reviews</TableHead>
              <TableHead>Website</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Top signal</TableHead>
              <TableHead>Audit</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLeads.map((lead) => {
              const pending = lead.auditStatus === "pending";
              const perf = lead.latestAudit?.mobilePerformanceScore;

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
                  <TableCell>
                    <ContactAvailabilityBadges
                      lead={lead}
                      audit={lead.latestAudit}
                      showBest={false}
                    />
                  </TableCell>
                  <TableCell>
                    {pending ? "—" : (lead.fitScore ?? "—")}
                  </TableCell>
                  <TableCell>
                    {pending ? (
                      <AuditPendingBadge />
                    ) : lead.fitLabel ? (
                      <Badge variant={fitBadgeVariant(lead.fitLabel)}>
                        {lead.fitLabel}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/leads/${lead.id}`}>{lead.businessName}</Link>
                  </TableCell>
                  <TableCell>{lead.category ?? "—"}</TableCell>
                  <TableCell>{lead.city ?? "—"}</TableCell>
                  <TableCell>{lead.rating ?? "—"}</TableCell>
                  <TableCell>{lead.reviewCount ?? "—"}</TableCell>
                  <TableCell>
                    {lead.websiteUrl ? (
                      <a
                        href={lead.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-xs"
                      >
                        Link
                      </a>
                    ) : (
                      <span className="text-zinc-500">None</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {pending ? (
                      <AuditPendingBadge />
                    ) : perf != null ? (
                      perf
                    ) : lead.websiteUrl ? (
                      "—"
                    ) : (
                      "N/A"
                    )}
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate">
                    {pending ? (
                      <AuditPendingBadge />
                    ) : (
                      (lead.mainIssue ?? "—")
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        lead.auditStatus === "complete"
                          ? "success"
                          : lead.auditStatus === "failed"
                            ? "danger"
                            : lead.auditStatus === "skipped"
                              ? "secondary"
                              : "pending"
                      }
                    >
                      {lead.auditStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/leads/${lead.id}`}>View</Link>
                      </Button>
                      <form action={updateReviewStatusAction}>
                        <input type="hidden" name="leadId" value={lead.id} />
                        <input
                          type="hidden"
                          name="reviewStatus"
                          value="approved_for_outreach"
                        />
                        <Button variant="ghost" size="sm" type="submit">
                          Approve
                        </Button>
                      </form>
                      <form action={updateReviewStatusAction}>
                        <input type="hidden" name="leadId" value={lead.id} />
                        <input type="hidden" name="reviewStatus" value="rejected" />
                        <Button variant="ghost" size="sm" type="submit">
                          Reject
                        </Button>
                      </form>
                      <form action={updateLeadStatusAction}>
                        <input type="hidden" name="leadId" value={lead.id} />
                        <input type="hidden" name="status" value="ready_to_contact" />
                        <Button variant="ghost" size="sm" type="submit">
                          Queue
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
