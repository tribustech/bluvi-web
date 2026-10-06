import 'server-only';
import { cache } from 'react';
import * as z from 'zod';
import { getOwnedLakes } from '@/core/booking';
import { call, isApiError, type Transport } from '@/core/transport';
import { getSessionToken } from '@/lib/server/session';
import { createServerTransport } from '@/lib/server/transport';
import type { Viewer } from '@/lib/server/viewer';
import { bounded } from './data';

/*
 * The T3 session read, TRI-STATE (the DetailPage data-loading contract): the viewer, null ONLY when
 * the visitor is known to be signed out (no session cookie, or the CMS says 401 / SESSION_DEAD),
 * and 'unknown' on any other failure (CMS 5xx, network, a contract break). lib/server/viewer.ts
 * getViewer() folds every failure into null — right for the chrome, wrong here: a signed-in angler
 * whose /users/me read failed would be shown the sign-in gate and «Intră».
 * TODO(shell): give lib/server/viewer.ts this read (getViewerState) and drop this copy.
 */

/** The session as the demo reads it: a viewer, signed out, or not known in time (bounded read). */
export type DemoViewer = Viewer | null | 'unknown';

const meSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  username: z.string(),
  avatar: z.object({ url: z.string() }).nullish(),
  role: z.object({ name: z.string() }).nullish(),
});

/** How long the owned-lakes read may take before the viewer is returned without operator entries. */
const OWNED_LAKES_TIMEOUT_MS = 1500;

const ME_QUERY = { populate: { avatar: { fields: ['url'] }, role: { fields: ['name'] } } };

export const readViewerState = cache(async (): Promise<DemoViewer> => {
  if (!(await getSessionToken())) return null;
  try {
    const t = createServerTransport();
    const [me, ownedLakes] = await Promise.all([
      call(t, { method: 'GET', path: '/users/me', query: ME_QUERY, auth: 'required' }, meSchema),
      // Bounded on its own: a slow /feed/owned-lakes only drops the operator entries, it never
      // holds /users/me past the page's session bound (which would turn the session 'unknown').
      bounded(readOwnedLakes(t), OWNED_LAKES_TIMEOUT_MS, []),
    ]);
    const role = me.role?.name ?? null;
    return {
      id: me.id,
      documentId: me.documentId,
      username: me.username,
      avatarUrl: me.avatar?.url ?? null,
      role,
      isOrganizer: role === 'Organizer',
      ownedLakes,
    };
  } catch (e) {
    if (isApiError(e) && (e.status === 401 || e.code === 'SESSION_DEAD')) return null;
    console.error('[t3 viewer] /users/me failed — session unknown', e);
    return 'unknown';
  }
});

/** A failure here only hides the operator entries; it never changes the session state. */
async function readOwnedLakes(t: Transport): Promise<Viewer['ownedLakes']> {
  try {
    return (await getOwnedLakes(t)).map(l => ({ documentId: l.documentId, name: l.name }));
  } catch {
    return [];
  }
}
