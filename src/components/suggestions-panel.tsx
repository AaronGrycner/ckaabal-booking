"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createSuggestionAction,
  deleteSuggestionAction,
  type SuggestionActionState,
} from "@/actions/suggestions";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SoftwareSuggestion } from "@/lib/db/schema";
import { formatCrmDateTime } from "@/lib/crm-utils";

const initialState: SuggestionActionState = {};

export function SuggestionsPanel({
  suggestions,
}: {
  suggestions: SoftwareSuggestion[];
}) {
  const [state, action, pending] = useActionState(
    createSuggestionAction,
    initialState,
  );
  const [deletePending, startDelete] = useTransition();
  const [deleteMessage, setDeleteMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a suggestion</CardTitle>
          <p className="text-sm text-zinc-400">
            Describe a change or improvement you&apos;d like in this CRM.
            Suggestions stay here until you delete them.
          </p>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-400">Suggestion</span>
              <textarea
                name="body"
                rows={4}
                required
                placeholder="e.g. Add a field for guarantee amount on each venue…"
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              />
            </label>
            {state.error && (
              <p className="text-sm text-red-400">{state.error}</p>
            )}
            {state.message && (
              <p className="text-sm text-emerald-400">{state.message}</p>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add suggestion"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Suggestions ({suggestions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActionMessage message={deleteMessage} className="mb-3" />
          {suggestions.length === 0 ? (
            <p className="text-sm text-zinc-500">No suggestions yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {suggestions.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap text-sm text-zinc-200">
                      {item.body}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">
                      {formatCrmDateTime(item.createdAt)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={deletePending}
                    onClick={() => {
                      setDeleteMessage(null);
                      startDelete(async () => {
                        const result = await deleteSuggestionAction(item.id);
                        if (!result.ok) {
                          setDeleteMessage({
                            type: "error",
                            text: result.error ?? "Failed to delete suggestion.",
                          });
                          return;
                        }
                        setDeleteMessage({
                          type: "success",
                          text: result.message ?? "Suggestion deleted.",
                        });
                      });
                    }}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
