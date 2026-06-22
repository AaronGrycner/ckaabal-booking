"use client";

import { useActionState } from "react";
import { runSearch, type SearchState } from "@/actions/search";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const initialState: SearchState = {};

export function SearchForm() {
  const [state, action, pending] = useActionState(runSearch, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Find live music venues</CardTitle>
        <p className="text-sm text-zinc-400">
          Search by venue type and city or region. Results appear immediately;
          site research runs in the background for contacts, genres, and booking
          signals.
        </p>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs text-zinc-400">
              Venue type
            </label>
            <Input
              name="niche"
              placeholder="live music venues"
              defaultValue="live music venues"
              required
            />
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs text-zinc-400">Location</label>
            <Input
              name="location"
              placeholder="Austin TX"
              defaultValue="Austin TX"
              required
            />
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-xs text-zinc-400">
              Max results
            </label>
            <Input
              name="maxResults"
              type="number"
              min={1}
              max={60}
              defaultValue={20}
            />
          </div>
          <div className="flex items-end md:col-span-1">
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Searching…" : "Search"}
            </Button>
          </div>
        </form>
        {state.error && (
          <p className="mt-3 text-sm text-red-400">{state.error}</p>
        )}
      </CardContent>
    </Card>
  );
}
