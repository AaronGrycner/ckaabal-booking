"use client";

import type { CrmFilter } from "@/lib/crm-utils";
import { CRM_FILTERS } from "@/lib/crm-utils";
import { cn } from "@/lib/utils";

export function CrmStatusFilter({
  value,
  onChange,
}: {
  value: CrmFilter;
  onChange: (filter: CrmFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {CRM_FILTERS.map((filter) => (
        <button
          key={filter.id}
          type="button"
          onClick={() => onChange(filter.id)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            value === filter.id
              ? "border-indigo-500 bg-indigo-600/20 text-indigo-200"
              : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200",
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
