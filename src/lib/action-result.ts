export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export type ActionMessage = {
  type: "success" | "error";
  text: string;
};

export function actionSuccess(message?: string): ActionResult {
  return message ? { ok: true, message } : { ok: true };
}

export function actionFailure(error: string): ActionResult {
  return { ok: false, error };
}

export function isNextRedirectError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "digest" in error &&
    String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

/** Errors with messages safe to show in the UI. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

export function toUserFacingError(
  error: unknown,
  fallback: string,
  ...allowedErrorTypes: Array<abstract new (...args: never[]) => Error>
): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  if (error instanceof UserFacingError) {
    return error.message;
  }

  if (allowedErrorTypes.some((Type) => error instanceof Type)) {
    return error.message;
  }

  console.error(error);
  return fallback;
}

export async function runServerAction(
  fn: () => Promise<void>,
  fallback: string,
): Promise<ActionResult> {
  try {
    await fn();
    return actionSuccess();
  } catch (error) {
    return actionFailure(toUserFacingError(error, fallback));
  }
}
