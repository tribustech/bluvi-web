import { type NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/session-cookie';
import { APP_VERSION, cmsUrl } from '@/lib/server/env';
import { forwardHeaders, isDeadSessionBody, isProxyAllowed, isSameOrigin, responseHeaders } from '@/lib/server/proxy';

type Ctx = { params: Promise<{ path: string[] }> };

/**
 * Thin authenticated proxy: browser → /api/cms/<cms path> → CMS with `Authorization: Bearer <cookie>`.
 * No caching, no body rewriting. A dead JWT clears the cookie so the client can sign out cleanly.
 */
async function handle(req: NextRequest, { params }: Ctx) {
  const { path } = await params;
  const cmsPath = `/${path.map(encodeURIComponent).join('/')}`;
  if (!isProxyAllowed(cmsPath)) {
    return NextResponse.json({ error: { status: 404, message: 'Not Found' } }, { status: 404 });
  }

  const mutating = req.method !== 'GET' && req.method !== 'HEAD';
  if (mutating && !isSameOrigin(req.url, req.headers.get('origin'), req.headers.get('sec-fetch-site'))) {
    return NextResponse.json({ error: { status: 403, message: 'Forbidden' } }, { status: 403 });
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value || undefined;
  const upstream = await fetch(`${cmsUrl()}${cmsPath}${req.nextUrl.search}`, {
    method: req.method,
    headers: forwardHeaders(req.headers, token, APP_VERSION),
    body: mutating ? await req.arrayBuffer() : undefined,
    cache: 'no-store',
  }).catch(() => null);

  if (!upstream) {
    return NextResponse.json({ error: { status: 502, message: 'CMS unreachable' } }, { status: 502 });
  }

  const body = upstream.status === 204 ? null : await upstream.text();
  const res = new NextResponse(body, { status: upstream.status, headers: responseHeaders(upstream.headers) });
  if (token && body && isDeadSessionBody(upstream.status, body)) res.cookies.delete(SESSION_COOKIE);
  return res;
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
