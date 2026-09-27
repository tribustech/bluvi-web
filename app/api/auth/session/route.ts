import { type NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/session-cookie';
import { APP_VERSION, cmsUrl } from '@/lib/server/env';
import { forwardHeaders, isDeadSessionBody } from '@/lib/server/proxy';

/** The signed-in user (`/users/me`), 401 when signed out; clears a dead cookie. */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: { status: 401, message: 'Signed out' } }, { status: 401 });

  const upstream = await fetch(`${cmsUrl()}/users/me`, {
    headers: forwardHeaders(new Headers(), token, APP_VERSION),
    cache: 'no-store',
  }).catch(() => null);
  if (!upstream) return NextResponse.json({ error: { status: 502, message: 'CMS unreachable' } }, { status: 502 });

  const text = await upstream.text();
  const res = new NextResponse(text, {
    status: upstream.status,
    headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
  });
  if (isDeadSessionBody(upstream.status, text)) res.cookies.delete(SESSION_COOKIE);
  return res;
}
