import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import { call, isApiError } from '@/core/transport';
import { getSessionToken } from './session';
import { createServerTransport } from './transport';

/**
 * The signed-in user as the app chrome needs it (tab «Profil» vs «Intră», header avatar,
 * «ADMINISTRARE» for organisers). Narrow on purpose: this object is serialised to the browser.
 */
export type Viewer = {
  id: number;
  documentId: string;
  username: string;
  avatarUrl: string | null;
  /** users-permissions role name: «Authenticated», «Organizer», … */
  role: string | null;
};

const meSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  username: z.string(),
  avatar: z.object({ url: z.string() }).nullish(),
  role: z.object({ name: z.string() }).nullish(),
});

// Strapi's /users/me returns no relations unless asked; only the fields the chrome reads.
const ME_QUERY = {
  populate: { avatar: { fields: ['url'] }, role: { fields: ['name'] } },
};

/**
 * The signed-in user, or null when signed out. One CMS call per request (React `cache`).
 *
 * Reads the session cookie, so whatever awaits it renders at request time: with Cache Components
 * that must happen inside a <Suspense> boundary (or pass the un-awaited promise to a client
 * component that `use()`s it behind one, as app/(site)/layout.tsx does). Never call it from a
 * `'use cache'` scope or a public cached read.
 *
 * A dead/expired session (401) is "signed out". Any other failure (CMS down, contract break) is
 * logged and also treated as signed out, so an outage degrades the chrome instead of failing
 * every page; the browser proxy clears a dead cookie on the next client call.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!(await getSessionToken())) return null;
  try {
    const me = await call(
      createServerTransport(),
      { method: 'GET', path: '/users/me', query: ME_QUERY, auth: 'required' },
      meSchema
    );
    return {
      id: me.id,
      documentId: me.documentId,
      username: me.username,
      avatarUrl: me.avatar?.url ?? null,
      role: me.role?.name ?? null,
    };
  } catch (e) {
    if (isApiError(e) && (e.status === 401 || e.code === 'SESSION_DEAD')) return null;
    console.error('[viewer] /users/me failed', e);
    return null;
  }
});
