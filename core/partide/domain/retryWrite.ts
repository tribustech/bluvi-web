/**
 * Network retry + timing helpers for the Partide write paths. fish `features/partide/domain/retryWrite.ts`.
 *
 * Retry lives around the HTTP call inside the domain actions, not in the screens: a screen-level
 * retry would re-run the action's LOCAL side effects too.
 *
 * Error shape: fish's axios interceptor rejected with plain objects and treated every real
 * `Error` as a client-side invariant. Here the transport throws `ApiError` (an Error subclass):
 * NETWORK and 5xx are transient; any other ApiError (4xx, INVALID_RESPONSE) and any other Error
 * are not worth retrying.
 */
import { isApiError } from '../../transport';

const DEFAULT_DELAYS_MS = [1500, 4000];

const realSleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** Network failure / timeout / 5xx → worth another attempt. 4xx and client-side invariants are not. */
export function isRetryableWriteError(err: unknown): boolean {
  if (isApiError(err)) return err.code === 'NETWORK' || (err.code === 'HTTP' && err.status >= 500);
  if (err instanceof Error) return false;
  const status = (err as { status?: number } | null | undefined)?.status;
  return status == null || status >= 500;
}

export type RetryOptions = {
  /** One delay per RETRY (so `attempts === delaysMs.length + 1`). */
  delaysMs?: number[];
  isRetryable?: (err: unknown) => boolean;
  /** Injected in tests so the real 5.5s of backoff isn't actually waited. */
  sleep?: (ms: number) => Promise<void>;
};

/** Runs `fn`, retrying transient failures. Rethrows the LAST error when it gives up. */
export async function retryWrite<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const delays = options.delaysMs ?? DEFAULT_DELAYS_MS;
  const retryable = options.isRetryable ?? isRetryableWriteError;
  const sleep = options.sleep ?? realSleep;

  let lastError: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === delays.length || !retryable(err)) throw err;
      await sleep(delays[attempt]);
    }
  }
  throw lastError;
}

/** How long the save curtain stays up at minimum, so a fast success can't strobe. */
export const MIN_CURTAIN_MS = 900;

/** Holds a settled promise until `ms` has passed — pads rejections too. */
export async function atLeast<T>(
  promise: Promise<T>,
  ms: number,
  sleep: (ms: number) => Promise<void> = realSleep
): Promise<T> {
  const [settled] = await Promise.all([
    promise.then(
      value => ({ ok: true as const, value }),
      error => ({ ok: false as const, error })
    ),
    sleep(ms),
  ]);
  if (settled.ok) return settled.value;
  throw settled.error;
}
