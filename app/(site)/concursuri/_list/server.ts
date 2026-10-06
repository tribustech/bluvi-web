import 'server-only';
import type { Transport, TransportRequest } from '@/core/transport';

/*
 * The page's server reads, each bounded: past READ_BUDGET_MS a read counts as failed and the
 * browser's own queries take over (their loading / error states) instead of a blank wait. Each
 * request gets its own AbortController, so an over-budget per-user fetch is really cancelled; the
 * race also bounds the cached public reads, which run in a 'use cache' scope that takes no signal.
 */

export const READ_BUDGET_MS = 3000;

function within<T>(promise: Promise<T>, ms: number): Promise<T> {
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

export function bounded(t: Transport, ms: number = READ_BUDGET_MS): Transport {
  return {
    request<T>(req: TransportRequest) {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(new Error(`CMS read over ${ms}ms`)), ms);
      const signal = req.signal ? AbortSignal.any([req.signal, ac.signal]) : ac.signal;
      return within(t.request<T>({ ...req, signal }), ms).finally(() => clearTimeout(timer));
    },
  };
}
