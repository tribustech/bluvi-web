import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { APIRequestContext, BrowserContext } from '@playwright/test';
import { qaUser } from '../../qa-user';

/*
 * The QA user's JWT, signed in once and shared by every spec (e2e and visual). The local CMS rate
 * limits POST /auth/local (429 after a handful of calls a minute, shared with every other agent
 * and test runner on this machine), so the token is cached on disk for an hour under
 * node_modules/.cache (git-ignored). A stale or revoked token is the CMS's call: delete the file.
 */

export const CMS = process.env.E2E_CMS_URL ?? 'http://localhost:1337/api';
const CACHE = join(process.cwd(), 'node_modules/.cache/bluvi-e2e/qa-jwt.json');
const TTL_MS = 60 * 60 * 1000;

export async function qaJwt(request: APIRequestContext): Promise<string> {
  try {
    const cached = JSON.parse(readFileSync(CACHE, 'utf8')) as { jwt: string; at: number; cms: string };
    if (cached.cms === CMS && Date.now() - cached.at < TTL_MS && cached.jwt) return cached.jwt;
  } catch {
    // No cache yet.
  }
  const auth = await request.post(`${CMS}/auth/local`, { data: qaUser() });
  if (!auth.ok()) {
    throw new Error(`QA user sign-in against ${CMS} failed: HTTP ${auth.status()} ${await auth.text()}`);
  }
  const jwt = (await auth.json()).jwt as string;
  mkdirSync(dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, JSON.stringify({ jwt, at: Date.now(), cms: CMS }));
  return jwt;
}

/** The web app's session cookie (httpOnly, set by the sign-in route in production). */
export async function signIn(context: BrowserContext, jwt: string, baseURL = 'http://localhost:3000') {
  const { hostname } = new URL(baseURL);
  await context.addCookies([{ name: 'bluvi_session', value: jwt, domain: hostname, path: '/', httpOnly: true, sameSite: 'Lax' }]);
}
