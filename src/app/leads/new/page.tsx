"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createManualLead,
  type CreateManualLeadState,
} from "@/actions/leads";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SOURCE_TYPES, sourceTypeLabel } from "@/lib/crm-utils";

const initialState: CreateManualLeadState = {};

export default function NewLeadPage() {
  const [state, action, pending] = useActionState(
    createManualLead,
    initialState,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/pipeline" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Pipeline
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Add Venue</h1>
        <p className="text-sm text-zinc-400">
          Manually add a venue to the booking pipeline.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Venue details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="text-zinc-400">Venue name *</span>
                <input
                  name="businessName"
                  required
                  className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-zinc-400">City</span>
                <input
                  name="city"
                  className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-zinc-400">Venue type</span>
                <input
                  name="category"
                  className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3"
                />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="text-zinc-400">Website URL</span>
                <input
                  name="websiteUrl"
                  type="url"
                  placeholder="https://"
                  className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-zinc-400">Phone</span>
                <input
                  name="phone"
                  className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-zinc-400">Contact email</span>
                <input
                  name="contactEmail"
                  type="email"
                  className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-zinc-400">Instagram URL</span>
                <input
                  name="instagramUrl"
                  className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-zinc-400">Facebook URL</span>
                <input
                  name="facebookUrl"
                  className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3"
                />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="text-zinc-400">LinkedIn URL</span>
                <input
                  name="linkedinUrl"
                  className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3"
                />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="text-zinc-400">Source type</span>
                <select
                  name="sourceType"
                  defaultValue="manual"
                  className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
                >
                  {SOURCE_TYPES.filter((t) => t !== "google_places").map(
                    (type) => (
                      <option key={type} value={type}>
                        {sourceTypeLabel(type)}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="text-zinc-400">Notes</span>
                <textarea
                  name="notes"
                  rows={3}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                />
              </label>
            </div>

            {state.error && (
              <p className="text-sm text-red-400">{state.error}</p>
            )}

            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save lead"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
