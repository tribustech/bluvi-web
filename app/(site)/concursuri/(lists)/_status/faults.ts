import 'server-only';
import { ApiError, type Transport, type TransportRequest } from '@/core/transport';
import { READ_BUDGET_MS } from '../../_list/server';
import type { StatusListKey } from './config';

/*
 * Development-only fault switch for the status lists' e2e tests (tests/e2e/competitions-list-status.spec.ts):
 * the first page is read on the server, where page.route cannot reach it. A test POSTs
 * {"faults": ["live"]} to /concursuri/e2e-fault-liste (../e2e-fault-liste/route.ts) and the next
 * renders of that list fail their server read like a network error — the page then renders per
 * request with no data and the BROWSER reads the first page, which the test controls with
 * page.route (loading, error, empty, card shapes). `<list>-crash` makes the page throw while it
 * renders (the route error boundary); `<list>-slow` holds the server read past the page's read
 * budget (READ_BUDGET_MS) — the Suspense fallback streams first, then the screen takes over and the
 * browser reads (the fallback → screen → cards hand-over). An empty list clears them. In production builds
 * this is a no-op (NODE_ENV is inlined) and the route answers 404.
 */

const g = globalThis as typeof globalThis & {
  __bluviStatusListFaults?: Set<string>;
};

export const statusListFaultsEnabled = () => process.env.NODE_ENV !== 'production';

export function setStatusListFaults(faults: string[]) {
  g.__bluviStatusListFaults = new Set(faults);
}

/** `t`, failing every read while `list` is faulted. */
export function withStatusListFault(t: Transport, list: StatusListKey): Transport {
  return {
    request<T>(req: TransportRequest) {
      if (statusListFaultsEnabled() && g.__bluviStatusListFaults?.has(list)) {
        return Promise.reject(
          new ApiError({
            message: `e2e fault: ${list}`,
            status: 0,
            code: 'NETWORK',
            path: req.path,
          }),
        );
      }
      if (statusListFaultsEnabled() && g.__bluviStatusListFaults?.has(`${list}-slow`)) {
        return new Promise<void>(res => setTimeout(res, READ_BUDGET_MS + 2000)).then(() => t.request<T>(req));
      }
      return t.request<T>(req);
    },
  };
}

/** Throws while rendering `list` when it is faulted with `<list>-crash` (the route error boundary's test). */
export function crashIfFaulted(list: StatusListKey) {
  if (statusListFaultsEnabled() && g.__bluviStatusListFaults?.has(`${list}-crash`)) throw new Error(`e2e fault: ${list}-crash`);
}
