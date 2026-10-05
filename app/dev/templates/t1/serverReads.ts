import 'server-only';
import type { TopBarViewer } from '@/components/nav/TopBar';
import type { Transport, TransportRequest } from '@/core/transport';
import { getSessionToken } from '@/lib/server/session';
import { getViewer, type Viewer } from '@/lib/server/viewer';
import { DEMO_PATH } from './StateSwitcher';

/*
 * The demo's server reads, each bounded by READ_BUDGET_MS: past the budget a read counts as failed
 * and the browser's own queries take over (loading / error states), instead of a blank wait. The
 * layout (top bar) and the page (prefetch) start their reads in PARALLEL, so a slow CMS holds the
 * fallback for one budget, not one per read in a row.
 */

/** How long the server waits for the CMS before handing over to the browser. */
export const READ_BUDGET_MS = 3000;

/** Rejects after `ms` — a read that takes longer is treated as failed (the browser retries it). */
export function within<T>(promise: Promise<T>, ms: number = READ_BUDGET_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`CMS read over ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * The server transport with every request bounded. Each request gets its own AbortController,
 * aborted at the budget, so an over-budget per-user fetch is really cancelled (not left running
 * after the page has given up on it); `within` also bounds the cached public reads, which run in
 * a 'use cache' scope that takes no signal.
 */
export function bounded(t: Transport): Transport {
  return {
    request<T>(req: TransportRequest) {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(new Error(`CMS read over ${READ_BUDGET_MS}ms`)), READ_BUDGET_MS);
      const signal = req.signal ? AbortSignal.any([req.signal, ac.signal]) : ac.signal;
      return within(t.request<T>({ ...req, signal })).finally(() => clearTimeout(timer));
    },
  };
}

/**
 * ?state=slow-server: every server read waits `ms` before it starts — past READ_BUDGET_MS, so
 * `bounded` gives up on it and the browser's queries take over (fallback → client handover). The
 * wait ends early when the read is aborted, so nothing outlives the request.
 */
export function delayed(t: Transport, ms: number = READ_BUDGET_MS + 1000): Transport {
  return {
    request<T>(req: TransportRequest) {
      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        req.signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(req.signal?.reason);
          },
          { once: true },
        );
      }).then(() => t.request<T>(req));
    },
  };
}

/**
 * The session, bounded (getViewer is per-request cached). Three answers, never two: the user; null
 * when there is no session (no cookie, or a dead one); 'unknown' when a session cookie IS there but
 * the read ran over the budget — a slow CMS must not make a signed-in user look signed out (the top
 * bar shows the unknown slot, not «Intră», and the per-user lists still run through /api/cms).
 */
export type DemoViewer = Viewer | null | 'unknown';

export async function readViewer(): Promise<DemoViewer> {
  const token = await getSessionToken();
  if (!token) return null;
  return within(getViewer()).catch(() => 'unknown' as const);
}

export const SIGNED_OUT: TopBarViewer = { status: 'out', signInHref: `/intra?next=${encodeURIComponent(DEMO_PATH)}` };
