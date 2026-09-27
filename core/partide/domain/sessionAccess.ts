/**
 * Pure parts of fish `features/partide/domain/sessionAccess.ts` + the leave-error rules of
 * `domain/hooks.ts` (`isAmbiguousLeaveError`, `decorateLeaveError`).
 * The I/O half (`confirmSessionAccess`) and the cache half of `cleanupSessionAccess` live in
 * `../mutations.ts`; its local half (rod alarms, the active-session pointer, live atoms,
 * navigation) is UI/device state and stays with the app.
 */
import { isApiError } from '../../transport';

/** `kicked` (PARTIDA:NOT_MEMBER — the session lives on without you) and `deleted`
 * (PARTIDA:NOT_FOUND — the whole partidă is gone) both mean revoked access; they differ only in
 * the removal notice the user sees. */
export type AccessConfirmation = 'valid' | 'kicked' | 'deleted' | 'unknown';

export function isRevoked(confirmation: AccessConfirmation): confirmation is 'kicked' | 'deleted' {
  return confirmation === 'kicked' || confirmation === 'deleted';
}

type LegacyErrorShape = {
  status?: number;
  bluCode?: string;
  response?: { status?: number; data?: { bluCode?: string; error?: { bluCode?: string; details?: { bluCode?: string } } } };
};

/** `ApiError.bluCode`, with fish's nested extraction kept for foreign/legacy error shapes. */
export function bluCodeOf(error: unknown): string | undefined {
  const candidate = error as LegacyErrorShape | null | undefined;
  return (
    candidate?.bluCode ??
    candidate?.response?.data?.bluCode ??
    candidate?.response?.data?.error?.bluCode ??
    candidate?.response?.data?.error?.details?.bluCode
  );
}

/**
 * The verdict for a failed `getSession` probe. Confirms only evidence of THIS private session's
 * revoked access: `revoked` requires the CMS's OWN bluCode, not a bare 403/404 — the API sits
 * behind Cloudflare, so a WAF/challenge 403 or a deploy-gap 404 would otherwise be
 * indistinguishable from a kick, and this verdict destroys the active pointer and navigates away.
 */
export function accessConfirmationFromError(error: unknown): AccessConfirmation {
  const code = bluCodeOf(error);
  if (code === 'PARTIDA:NOT_MEMBER') return 'kicked';
  if (code === 'PARTIDA:NOT_FOUND') return 'deleted';
  return 'unknown';
}

/**
 * The leave request might have completed server-side while its response was lost.
 * Network/timeout/5xx outcomes are ambiguous; other 4xx policy errors are not.
 * fish read axios codes (ECONNABORTED/ETIMEDOUT/ERR_NETWORK); the transport reports all of
 * them as `ApiError` code NETWORK (status 0).
 */
export function isAmbiguousLeaveError(error: unknown): boolean {
  if (isApiError(error)) return error.code === 'NETWORK' || (error.code === 'HTTP' && error.status >= 500);
  const candidate = error as { status?: number; response?: { status?: number }; code?: string } | null | undefined;
  const status = candidate?.status ?? candidate?.response?.status;
  if (status !== undefined) return status >= 500;
  const code = candidate?.code;
  return code === 'ECONNABORTED' || code === 'ETIMEDOUT' || code === 'ERR_NETWORK';
}

export type RetryableLeaveError = {
  retryable: true;
  accessConfirmation: Exclude<AccessConfirmation, 'kicked' | 'deleted'>;
};

export function decorateLeaveError(
  error: unknown,
  accessConfirmation: Exclude<AccessConfirmation, 'kicked' | 'deleted'>
): RetryableLeaveError & Record<string, unknown> {
  // fish's rejections were plain `{ message, status, bluCode }` objects and were spread whole;
  // an ApiError keeps the same fields visible to the UI.
  const base = isApiError(error)
    ? { message: error.message, status: error.status, bluCode: error.bluCode, code: error.code }
    : error instanceof Error
      ? { message: error.message }
      : ((error as Record<string, unknown> | null) ?? {});
  return { ...base, retryable: true, accessConfirmation };
}
