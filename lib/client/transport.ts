import { baseInit, buildPath, performFetch, type Transport, type TransportRequest } from '@/core/transport';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';
const PUBLIC_CMS_URL = process.env.NEXT_PUBLIC_CMS_URL?.replace(/\/$/, '');

/**
 * Browser transport. Per-user calls go through the same-origin proxy (/api/cms/...), which
 * attaches the httpOnly session cookie as a bearer. Public GETs go straight to the CMS so
 * they are served from Cloudflare's edge cache (requires CORS for the web origin — CMS patch P4);
 * set `direct: false` to route them through the proxy too.
 */
export function createBrowserTransport({ direct = Boolean(PUBLIC_CMS_URL) }: { direct?: boolean } = {}): Transport {
  return {
    async request<T>(req: TransportRequest) {
      const path = buildPath(req.path, req.query);
      const publicDirect = direct && req.method === 'GET' && req.auth === 'none';
      const url = publicDirect ? `${PUBLIC_CMS_URL}${path}` : `/api/cms${path}`;
      const init = baseInit(req, APP_VERSION);
      return performFetch<T>(fetch, url, { ...init, credentials: publicDirect ? 'omit' : 'same-origin' }, req.path);
    },
  };
}
