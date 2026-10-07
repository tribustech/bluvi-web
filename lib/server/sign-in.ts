import 'server-only';
import { NextResponse } from 'next/server';
import { appHeaders } from '@/core/transport/http';
import { isSecureRequest, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session-cookie';
import { APP_VERSION, cmsUrl } from './env';

type CmsAuthResponse = { jwt?: unknown; firebaseToken?: unknown; user?: Record<string, unknown> };

/** bluCode of our own refusal of a malformed CMS session (the page shows the generic error). */
export const INVALID_SESSION_CODE = 'WEB:INVALID_SESSION';

const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/**
 * fish AuthContext#finishSignIn + helpers/sessionToken#readSessionToken: the CMS answer must be a
 * three-part JWT whose payload decodes to `{ id: number, exp: number }` and has not expired. The
 * signature is not checked (only the CMS can); this only refuses to store something that is not
 * a session at all.
 */
export function isUsableSessionJwt(jwt: unknown, nowMs: number): jwt is string {
  if (typeof jwt !== 'string' || !JWT_SHAPE.test(jwt)) return false;
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8')) as { id?: unknown; exp?: unknown };
    return typeof payload.id === 'number' && typeof payload.exp === 'number' && payload.exp * 1000 > nowMs;
  } catch {
    return false;
  }
}

/**
 * POSTs to a CMS auth route; on success sets the session cookie and returns the user (never the
 * JWT) plus the Firebase custom token the social routes mint (fish signInToFirebase; null when
 * the CMS has none — /auth/local never sends one). The custom token is short-lived and scoped to
 * this uid, the same thing /api/firebase-token hands the browser.
 */
export async function signInThroughCms(
  requestUrl: string,
  cmsPath: string,
  body: string,
  contentType: string
): Promise<NextResponse> {
  const upstream = await fetch(`${cmsUrl()}${cmsPath}`, {
    method: 'POST',
    headers: { 'content-type': contentType, accept: 'application/json', ...appHeaders(APP_VERSION) },
    body,
    cache: 'no-store',
  }).catch(() => null);
  if (!upstream) return NextResponse.json({ error: { status: 502, message: 'CMS unreachable' } }, { status: 502 });

  const text = await upstream.text();
  if (!upstream.ok) {
    return new NextResponse(text, { status: upstream.status, headers: { 'content-type': 'application/json' } });
  }
  let data: CmsAuthResponse;
  try {
    data = JSON.parse(text) as CmsAuthResponse;
  } catch {
    data = {};
  }
  if (!isUsableSessionJwt(data.jwt, Date.now())) {
    return NextResponse.json(
      { error: { status: 502, message: 'No usable session from CMS', details: { bluCode: INVALID_SESSION_CODE } } },
      { status: 502 }
    );
  }

  const { id, documentId, username, email } = data.user ?? {};
  const firebaseToken = typeof data.firebaseToken === 'string' && data.firebaseToken ? data.firebaseToken : null;
  const res = NextResponse.json(
    { user: { id, documentId, username, email }, firebaseToken },
    { headers: { 'cache-control': 'private, no-store' } }
  );
  res.cookies.set(SESSION_COOKIE, data.jwt, sessionCookieOptions(isSecureRequest(requestUrl)));
  return res;
}
