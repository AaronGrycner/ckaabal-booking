"use client";

import { useActionState } from "react";
import { saveLeadNotesAction } from "@/actions/leads";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionResult } from "@/lib/action-result";
import type { Lead } from "@/lib/db/schema";

const initialState: ActionResult = { ok: true };

export function LeadNotesPanel({ lead }: { lead: Lead }) {
  const [state, action, pending] = useActionState(
    async (_prev: ActionResult, formData: FormData) => saveLeadNotesAction(formData),
    initialState,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notes</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <input type="hidden" name="leadId" value={lead.id} />
          <textarea
            name="notes"
            defaultValue={lead.notes ?? ""}
            rows={4}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            placeholder="Your notes… Rough notes are fine — they'll be rephrased politely when generating outreach emails."
          />
          {!state.ok && (
            <ActionMessage message={{ type: "error", text: state.error }} />
          )}
          {state.ok && state.message && (
            <ActionMessage message={{ type: "success", text: state.message }} />
          )}
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            {pending ? "Saving…" : "Save notes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
