"use client";

import { useRouter } from "next/navigation";
import { updateOutcome } from "@/actions/leads";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Lead, Outcome } from "@/lib/db/schema";
import { OUTCOMES, outcomeLabel } from "@/lib/crm-utils";

export function LeadOutcomeSelect({ lead }: { lead: Lead }) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Outcome</CardTitle>
      </CardHeader>
      <CardContent>
        <select
          defaultValue={lead.outcome}
          onChange={async (e) => {
            await updateOutcome(lead.id, e.target.value as Outcome);
            router.refresh();
          }}
          className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
        >
          {OUTCOMES.map((outcome) => (
            <option key={outcome} value={outcome}>
              {outcomeLabel(outcome)}
            </option>
          ))}
        </select>
      </CardContent>
    </Card>
  );
}
