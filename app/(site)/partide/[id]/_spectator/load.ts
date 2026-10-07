import 'server-only';
import { cache } from 'react';
import { connection } from 'next/server';
import { getCommunitySession, type CommunitySessionDetailDTO } from '@/core/partide';
import { isApiError } from '@/core/transport';
import { createServerTransport } from '@/lib/server/transport';

/*
 * The public partidă, read on the server: GET /feed/community/sessions/:documentId (auth: false),
 * a cached public read (lib/server/public-get.ts) kept as the CMS tells its edge — 60 s while the
 * partidă is live, 24 h once it has ended — and purged by its tag `session-<documentId>`.
 *
 *  - `ok`: the partidă; the page hands it to the browser's communitySessionQuery (HydrationBoundary),
 *    which then polls it every 60 s while live (c14).
 *  - `missing`: the CMS answered 404 — unknown, deleted, OR private (visibleOnProfile false: every
 *    public community read filters on it, domain invariant 15). The page must NOT call notFound():
 *    the not-found state renders through OwnOrSpectator's `notFound` slot (noindex), so the member
 *    branch (M4-B2) can still show a member their own private partidă.
 *  - `unread`: the read failed or timed out — the browser's query reads it again and shows its own
 *    error + «Reîncearcă» (c2). `connection()` first, so a failed read is never baked into the
 *    static output.
 * In development, ids starting with `e2e-` are never read here (`unread`): the e2e specs answer
 * them in the browser (page.route), which cannot reach a server read.
 */

export type SessionLoad = { kind: 'ok'; detail: CommunitySessionDetailDTO } | { kind: 'missing' } | { kind: 'unread' };

const READ_BUDGET_MS = 4000;

/** Strapi documentIds (and the e2e ids): anything else is not a partidă. */
const ID = /^[A-Za-z0-9_-]{1,64}$/;

const e2eId = (id: string) => process.env.NODE_ENV !== 'production' && id.startsWith('e2e-');

function within<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`community session read over ${ms}ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

export const loadCommunitySession = cache(async (id: string): Promise<SessionLoad> => {
  if (!ID.test(id)) return { kind: 'missing' };
  if (e2eId(id)) return { kind: 'unread' };
  try {
    const detail = await within(getCommunitySession(createServerTransport(), id), READ_BUDGET_MS);
    return { kind: 'ok', detail };
  } catch (e) {
    if (isApiError(e) && (e.status === 404 || e.status === 400)) return { kind: 'missing' };
    await connection();
    return { kind: 'unread' };
  }
});
