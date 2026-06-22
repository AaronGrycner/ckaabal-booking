"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AuditPendingPoller({ hasPending }: { hasPending: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [hasPending, router]);

  if (!hasPending) return null;

  return (
    <div className="mb-4 rounded-md border border-indigo-900/50 bg-indigo-950/30 px-4 py-3 text-sm text-indigo-200">
      Auditing websites… scores will update automatically.
    </div>
  );
}
