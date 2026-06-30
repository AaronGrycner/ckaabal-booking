"use client";

import { updateOutcome } from "@/actions/leads";
import { ActionMessage } from "@/components/action-message";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Lead, Outcome } from "@/lib/db/schema";
import { OUTCOMES, outcomeLabel } from "@/lib/crm-utils";
import { useActionRunner } from "@/hooks/use-action-runner";

export function LeadOutcomeSelect({ lead }: { lead: Lead }) {
  const { isPending, message, run } = useActionRunner();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Outcome</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <select
          defaultValue={lead.outcome}
          disabled={isPending}
          onChange={(e) => {
            run(() => updateOutcome(lead.id, e.target.value as Outcome));
          }}
          className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
        >
          {OUTCOMES.map((outcome) => (
            <option key={outcome} value={outcome}>
              {outcomeLabel(outcome)}
            </option>
          ))}
        </select>
        <ActionMessage message={message} className="text-xs" />
      </CardContent>
    </Card>
  );
}
