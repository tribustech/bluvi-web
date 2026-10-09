/*
 * beforeSend / beforeSendTransaction / beforeBreadcrumb (m8.sentry): what may never reach Sentry,
 * wherever it hides in an event (request, message, exception values, breadcrumbs, extra, contexts):
 *  - the session: Authorization / Cookie / Set-Cookie headers, the `bluvi_session` cookie, any JWT;
 *  - tokens in query strings (`?token=`, `?jwt=`, `?access_token=`, `?id_token=`, `?code=` …);
 *  - e-mail addresses;
 *  - every user field but the numeric id (no IP, no e-mail, no username).
 * Pure and SDK-agnostic: works on the plain event object, so it is unit-tested without Sentry.
 */

export const FILTERED = '[Filtered]';

/** Object keys whose value is dropped wherever they appear (headers, extra, contexts, data). */
const SECRET_KEYS = /^(authorization|proxy-authorization|cookie|cookies|set-cookie|x-api-key|password|passwd|secret|token|jwt|access_token|accesstoken|id_token|idtoken|refresh_token|bluvi_session)$/i;

/** Query parameters whose value is dropped from any URL or query string. */
const SECRET_PARAM = /^(token|jwt|access_token|accesstoken|id_token|idtoken|refresh_token|code|password|secret|signature|sig|key|auth)$/i;
const SECRET_QUERY = /((?:^|[?&;])(?:token|jwt|access_token|accessToken|id_token|idToken|refresh_token|code|password|secret|signature|sig|key|auth)=)[^&#\s"']*/gi;

const JWT = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g;
const BEARER = /\b(Bearer)\s+[A-Za-z0-9._~+/=-]+/gi;
const SESSION_COOKIE_PAIR = /\b(bluvi_session=)[^;\s"']*/gi;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function scrubString(value: string): string {
  return value
    .replace(SESSION_COOKIE_PAIR, `$1${FILTERED}`)
    .replace(BEARER, `$1 ${FILTERED}`)
    .replace(JWT, '[jwt]')
    .replace(SECRET_QUERY, `$1${FILTERED}`)
    .replace(EMAIL, '[email]');
}

const MAX_DEPTH = 10;

function scrubValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth > MAX_DEPTH || seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = scrubValue(value[i], depth + 1, seen);
    return value;
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (SECRET_KEYS.test(key)) {
      obj[key] = FILTERED;
      continue;
    }
    obj[key] = scrubValue(obj[key], depth + 1, seen);
  }
  return obj;
}

type Scrubbable = {
  request?: { headers?: Record<string, unknown>; cookies?: unknown; [k: string]: unknown };
  user?: Record<string, unknown> | null;
  [k: string]: unknown;
};

/** Scrubs an event in place and returns it (the shape Sentry's beforeSend expects). */
export function scrubEvent<E>(event: E): E {
  const e = event as unknown as Scrubbable;
  if (e.request) {
    delete e.request.cookies;
    // Sentry's query_string may also be [key, value] pairs or an object.
    const qs = e.request.query_string;
    if (Array.isArray(qs)) {
      for (const pair of qs) if (Array.isArray(pair) && typeof pair[0] === 'string' && SECRET_PARAM.test(pair[0])) pair[1] = FILTERED;
    } else if (qs && typeof qs === 'object') {
      for (const k of Object.keys(qs)) if (SECRET_PARAM.test(k)) (qs as Record<string, unknown>)[k] = FILTERED;
    }
    if (e.request.headers) {
      for (const name of Object.keys(e.request.headers)) if (SECRET_KEYS.test(name)) delete e.request.headers[name];
    }
  }
  if (e.user) {
    const id = e.user.id;
    e.user = id === undefined || id === null ? null : { id: String(id) };
  }
  const user = e.user;
  delete e.user;
  scrubValue(e, 0, new WeakSet());
  if (user) e.user = user;
  return event;
}

/** Breadcrumbs (fetch / navigation / console) carry URLs and messages: same rules. */
export function scrubBreadcrumb<B>(breadcrumb: B): B {
  scrubValue(breadcrumb, 0, new WeakSet());
  return breadcrumb;
}
