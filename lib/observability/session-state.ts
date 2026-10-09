/*
 * fish helpers/sessionToken.ts (readSessionToken) + AuthContext.tsx:80-105: what the session JWT says
 * about itself, FOR REPORTING ONLY. The signature is never checked; nothing here is an auth decision.
 * Only the state and the numeric user id leave this module — never the token.
 *
 * The Strapi payload is `{ id: number, iat: number, exp: number }`.
 */

import { SESSION_COOKIE } from '@/lib/auth/session-cookie';

export type SessionState = 'none' | 'valid' | 'expired' | 'unreadable';
export type SessionInfo = { state: SessionState; userId?: number };

function base64UrlDecode(input: string): string | null {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  try {
    if (typeof atob !== 'function') return null;
    return atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  } catch {
    return null;
  }
}

export function readSessionToken(token: string | null | undefined, nowMs: number): SessionInfo {
  if (!token) return { state: 'none' };
  const parts = token.split('.');
  if (parts.length !== 3) return { state: 'unreadable' };
  const json = base64UrlDecode(parts[1]);
  if (!json) return { state: 'unreadable' };
  let payload: { id?: unknown; exp?: unknown };
  try {
    payload = JSON.parse(json);
  } catch {
    return { state: 'unreadable' };
  }
  if (!payload || typeof payload !== 'object') return { state: 'unreadable' };
  const userId = typeof payload.id === 'number' ? payload.id : undefined;
  const exp = typeof payload.exp === 'number' ? payload.exp : undefined;
  if (exp === undefined) return { state: 'unreadable', userId };
  return { state: exp * 1000 <= nowMs ? 'expired' : 'valid', userId };
}

/** The session cookie's value from a raw `Cookie` header (or header array), or undefined. */
export function sessionTokenFromCookieHeader(header: string | string[] | undefined | null): string | undefined {
  const raw = Array.isArray(header) ? header.join('; ') : header;
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== SESSION_COOKIE) continue;
    const value = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(value) || undefined;
    } catch {
      return value || undefined;
    }
  }
  return undefined;
}

/** session.state + user.id for a server request's Cookie header. */
export function sessionInfoFromCookieHeader(header: string | string[] | undefined | null, nowMs: number): SessionInfo {
  return readSessionToken(sessionTokenFromCookieHeader(header), nowMs);
}
