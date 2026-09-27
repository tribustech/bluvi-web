import { type NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/session-cookie';
import { APP_VERSION, cmsUrl } from '@/lib/server/env';
import { forwardHeaders } from '@/lib/server/proxy';

/**
 * Firebase custom token for the signed-in user (chat + Partide Firestore auth), minted by the
 * CMS at /feed/firebase-token — same source fish uses on cold start. Returned to the browser
 * only because signInWithCustomToken runs there; it is short-lived and scoped to this uid.
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: { status: 401, message: 'Signed out' } }, { status: 401 });
  const upstream = await fetch(`${cmsUrl()}/feed/firebase-token`, {
    headers: forwardHeaders(new Headers(), token, APP_VERSION),
    cache: 'no-store',
  }).catch(() => null);
  if (!upstream) return NextResponse.json({ error: { status: 502, message: 'CMS unreachable' } }, { status: 502 });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
  });
}
