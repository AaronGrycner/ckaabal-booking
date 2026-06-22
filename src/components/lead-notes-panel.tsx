"use client";

import { saveLeadNotesAction } from "@/actions/leads";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Lead } from "@/lib/db/schema";

export function LeadNotesPanel({ lead }: { lead: Lead }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notes</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={saveLeadNotesAction} className="space-y-3">
          <input type="hidden" name="leadId" value={lead.id} />
          <textarea
            name="notes"
            defaultValue={lead.notes ?? ""}
            rows={4}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            placeholder="Your notes… Rough notes are fine — they'll be rephrased politely when generating outreach emails."
          />
          <Button type="submit" size="sm" variant="secondary">
            Save notes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
