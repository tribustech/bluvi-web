import { isApiError } from '@/core/transport';

/*
 * The quiet retry of Știre's and Sponsor's main read (load.ts): fish's default QueryClient retries
 * useNewsById / useSponsorById behind its LoadingScreen before ErrorScreen, so a CMS blip the app
 * hides must not become a full error page here. Pure (the sleep is injectable) for the unit test.
 */

const RETRIES = 2;
const BACKOFF_MS = [300, 900];

/** A failure worth another try: no answer (network / timeout) or a server error — never a 4xx. */
export function isRetryable(e: unknown): boolean {
  return isApiError(e) && (e.status === 0 || e.code === 'NETWORK' || e.status >= 500);
}

/** `read`, tried again on a retryable failure (RETRIES more times, BACKOFF_MS apart). */
export async function withRetry<T>(read: () => Promise<T>, sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await read();
    } catch (e) {
      if (attempt >= RETRIES || !isRetryable(e)) throw e;
      await sleep(BACKOFF_MS[attempt]);
    }
  }
}
