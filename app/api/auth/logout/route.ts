import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/session-cookie';

/** Drops the session cookie. The JWT itself cannot be revoked on the CMS (stateless). */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
