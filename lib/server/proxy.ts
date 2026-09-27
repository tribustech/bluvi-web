import { appHeaders } from '@/core/transport/http';

/**
 * CMS path prefixes the browser may reach through /api/cms. Everything the ported API
 * modules call must match one of these (asserted by proxy.test.ts, which scans core/).
 * Admin, content-manager and anything not listed stay unreachable from the browser.
 */
export const PROXY_ALLOWED_PREFIXES = [
  '/feed/',
  '/ai/',
  '/announcements',
  '/catches',
  '/competitions',
  '/extra-scales',
  '/facilities',
  '/feedbacks',
  '/fishes',
  '/lake-requests',
  '/lake-suggestions',
  '/lakes',
  '/notification-users',
  '/notifications',
  '/penalties',
  '/polls',
  '/raffle-sessions',
  '/rankings',
  '/registrations',
  '/reservations',
  '/reviews',
  '/sectors',
  '/sponsors',
  '/stands',
  '/upload',
  '/user',
  '/users',
  '/weighing-logs',
  '/weighings',
] as const;

export function isProxyAllowed(cmsPath: string): boolean {
  if (cmsPath.includes('..')) return false;
  return PROXY_ALLOWED_PREFIXES.some(p => (p.endsWith('/') ? cmsPath.startsWith(p) : cmsPath === p || cmsPath.startsWith(`${p}/`) || cmsPath.startsWith(`${p}?`)));
}

/** Request headers forwarded to the CMS. Cookies never leave the web origin. */
export function forwardHeaders(incoming: Headers, token: string | undefined, appVersion: string): Headers {
  const out = new Headers();
  out.set('accept', incoming.get('accept') ?? 'application/json');
  const ct = incoming.get('content-type');
  if (ct) out.set('content-type', ct);
  for (const [k, v] of Object.entries(appHeaders(appVersion))) out.set(k, v);
  if (token) out.set('authorization', `Bearer ${token}`);
  return out;
}

/** Response headers passed back to the browser. `set-cookie` from the CMS is dropped. */
export function responseHeaders(upstream: Headers): Headers {
  const out = new Headers();
  for (const name of ['content-type', 'date', 'etag', 'last-modified']) {
    const v = upstream.get(name);
    if (v) out.set(name, v);
  }
  out.set('cache-control', 'private, no-store');
  return out;
}

/** Same rule as core's apiErrorFromResponse: this 401 means the JWT is dead. */
export function isDeadSessionBody(status: number, body: string): boolean {
  if (status !== 401) return false;
  try {
    const msg = (JSON.parse(body) as { error?: { message?: string } })?.error?.message;
    return msg === 'Missing or invalid credentials' || msg === 'Invalid credentials';
  } catch {
    return false;
  }
}

/**
 * CSRF guard for state-changing calls: the session cookie is SameSite=Lax, and on top of
 * that a mutating request must come from our own origin.
 */
export function isSameOrigin(requestUrl: string, origin: string | null, secFetchSite: string | null): boolean {
  if (secFetchSite) return secFetchSite === 'same-origin';
  if (!origin) return false;
  return new URL(requestUrl).origin === origin;
}
