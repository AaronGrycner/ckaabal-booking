"use client";

import { cn } from "@/lib/utils";
import { REVIEW_FILTERS, type ReviewFilter } from "@/lib/crm-utils";

export function ReviewStatusFilter({
  value,
  onChange,
}: {
  value: ReviewFilter;
  onChange: (value: ReviewFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {REVIEW_FILTERS.map((filter) => (
        <button
          key={filter.id}
          type="button"
          onClick={() => onChange(filter.id)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            value === filter.id
              ? "bg-zinc-100 text-zinc-900"
              : "bg-zinc-800 text-zinc-400 hover:text-zinc-200",
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
