import { baseInit, buildPath, performFetch, type Transport, type TransportRequest } from '@/core/transport';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';
const PUBLIC_CMS_URL = process.env.NEXT_PUBLIC_CMS_URL?.replace(/\/$/, '');

/**
 * Browser transport. Per-user calls go through the same-origin proxy (/api/cms/...), which
 * attaches the httpOnly session cookie as a bearer. Public GETs go straight to the CMS so
 * they are served from Cloudflare's edge cache; set `direct: false` to route them through the
 * proxy too.
 *
 * A direct public GET must stay a CORS "simple request": only `Accept`, no `x-app-*` headers.
 * Strapi's CORS allows `*` origins but not those custom headers, so adding them triggers a
 * preflight the CMS refuses (seen 2026-10-04 on /feed/sponsors/dashboard). The CMS only reads
 * `x-app-*` on per-user routes (version check, push tokens, partidă logs), which use the proxy.
 */
export function createBrowserTransport({ direct = Boolean(PUBLIC_CMS_URL) }: { direct?: boolean } = {}): Transport {
  return {
    async request<T>(req: TransportRequest) {
      const path = buildPath(req.path, req.query);
      const publicDirect = direct && req.method === 'GET' && req.auth === 'none';
      if (publicDirect) {
        return performFetch<T>(
          fetch,
          `${PUBLIC_CMS_URL}${path}`,
          { method: 'GET', headers: { accept: 'application/json' }, signal: req.signal, credentials: 'omit' },
          req.path
        );
      }
      const init = baseInit(req, APP_VERSION);
      return performFetch<T>(fetch, `/api/cms${path}`, { ...init, credentials: 'same-origin' }, req.path);
    },
  };
}
