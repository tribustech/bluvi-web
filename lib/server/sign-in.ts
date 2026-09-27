import 'server-only';
import { NextResponse } from 'next/server';
import { appHeaders } from '@/core/transport/http';
import { isSecureRequest, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session-cookie';
import { APP_VERSION, cmsUrl } from './env';

type CmsAuthResponse = { jwt?: string; user?: Record<string, unknown> };

/** POSTs to a CMS auth route; on success sets the session cookie and returns the user (never the JWT). */
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
  const data = JSON.parse(text) as CmsAuthResponse;
  if (!data.jwt) return NextResponse.json({ error: { status: 502, message: 'No session from CMS' } }, { status: 502 });

  const { id, documentId, username, email } = data.user ?? {};
  const res = NextResponse.json({ user: { id, documentId, username, email } });
  res.cookies.set(SESSION_COOKIE, data.jwt, sessionCookieOptions(isSecureRequest(requestUrl)));
  return res;
}
