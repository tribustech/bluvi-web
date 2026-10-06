import { isApiError } from '@/core/transport';

/*
 * This page's reads fail fast: one retry (≈0.6 s later) for a network or 5xx failure, none for a
 * 4xx (the same answer would come back). The app default (two retries with backoff) held the
 * loading bones on screen for 7–8 s before a failed read reached its error and «Încearcă din nou».
 * Spread into every useQuery / useInfiniteQuery of the competition page.
 */
export const PAGE_RETRY = {
  retry: (failures: number, error: unknown) =>
    failures < 1 && !(isApiError(error) && error.status >= 400 && error.status < 500),
  retryDelay: 600,
} as const;

/**
 * A live competition left open re-reads its live parts this often while the tab is visible
 * (parity b.foreground-refresh / b.live-refresh; TanStack pauses the interval in a hidden tab).
 */
export const LIVE_POLL_MS = 45_000;
