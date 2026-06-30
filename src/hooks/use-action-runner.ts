"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import type { ActionMessage, ActionResult } from "@/lib/action-result";

type RunOptions = {
  refresh?: boolean;
  successMessage?: string;
  onSuccess?: () => void;
};

export function useActionRunner() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<ActionMessage | null>(null);

  const run = useCallback(
    (action: () => Promise<ActionResult>, options?: RunOptions) => {
      setMessage(null);
      startTransition(async () => {
        try {
          const result = await action();
          if (!result.ok) {
            setMessage({ type: "error", text: result.error });
            return;
          }

          const successText = options?.successMessage ?? result.message;
          if (successText) {
            setMessage({ type: "success", text: successText });
          }

          options?.onSuccess?.();

          if (options?.refresh !== false) {
            router.refresh();
          }
        } catch {
          setMessage({
            type: "error",
            text: "Something went wrong. Try again.",
          });
        }
      });
    },
    [router],
  );

  const clearMessage = useCallback(() => setMessage(null), []);

  return { isPending, message, run, clearMessage };
}
