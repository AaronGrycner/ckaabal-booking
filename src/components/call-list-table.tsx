"use client";

import Link from "next/link";
import { setCallList } from "@/actions/leads";
import { BusinessHoursDisplay } from "@/components/business-hours-display";
import { ActionMessage } from "@/components/action-message";
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
import type { Lead } from "@/lib/db/schema";
import { useActionRunner } from "@/hooks/use-action-runner";

function phoneHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits ? `tel:${digits}` : null;
}

export function CallListTable({ leads }: { leads: Lead[] }) {
  const { isPending, message, run } = useActionRunner();

  return (
    <div className="space-y-3">
      <ActionMessage message={message} />
      <div className="rounded-lg border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Venue</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Business hours</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => {
              const tel = lead.phone ? phoneHref(lead.phone) : null;

              return (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">
                    <div className="space-y-1">
                      <Link href={`/leads/${lead.id}`}>{lead.businessName}</Link>
                      {lead.city && (
                        <p className="text-xs font-normal text-zinc-500">
                          {lead.city}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {lead.phone && tel ? (
                      <a
                        href={tel}
                        className="text-sm text-sky-400 hover:text-sky-300"
                      >
                        {lead.phone}
                      </a>
                    ) : (
                      <Badge variant="secondary">No phone</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[220px]">
                    <BusinessHoursDisplay hours={lead.businessHours} />
                  </TableCell>
                  <TableCell className="text-sm text-zinc-400">
                    {lead.category ?? "—"}
                  </TableCell>
                  <TableCell className="min-w-[200px] max-w-[320px] text-sm leading-relaxed text-zinc-300">
                    {lead.notes?.trim() ? (
                      <p className="whitespace-pre-wrap">{lead.notes.trim()}</p>
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/leads/${lead.id}`}>View</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        disabled={isPending}
                        onClick={() => run(() => setCallList(lead.id, false))}
                      >
                        Remove
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {!leads.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-zinc-500">
                  No leads on your call list. Add leads from a lead detail page or
                  the pipeline.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
