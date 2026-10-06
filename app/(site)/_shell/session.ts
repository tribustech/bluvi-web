import 'server-only';
import { cache } from 'react';
import { connection } from 'next/server';
import * as z from 'zod';
import { getOwnedLakes } from '@/core/booking';
import { call, isApiError, networkError, type Transport, type TransportRequest } from '@/core/transport';
import { getSessionToken } from '@/lib/server/session';
import { createServerTransport } from '@/lib/server/transport';
import type { Viewer } from '@/lib/server/viewer';

/**
 * The session as the shell and the pages read it — THREE answers, never two (parity global.shell.c5;
 * fish only signs out on a 401, services/api/api.ts):
 * - the user (`ShellUser`): `ownedLakesFailed` when /feed/owned-lakes could not be read, so the bar
 *   keeps «Administrare» with a retry row instead of silently dropping the operator's entries;
 * - `null`: signed out — no session cookie, or the CMS refused it (401 / SESSION_DEAD);
 * - `{ status: 'unknown' }`: a session cookie is there but /users/me failed (5xx, network, a
 *   contract break) or gave no answer within SESSION_READ_MS. Never shown as signed out: the bar
 *   shows its retry slot, the pages a neutral / pending state.
 *
 * lib/server/viewer.ts getViewer() folds every failure into null («signed out»); the shell and
 * Acasă read this instead. TODO(lib/server/viewer): move this read there and retire the copy.
 *
 * One read per request (React `cache`). The read is bounded by its own deadline (the transport
 * aborts the fetch), so the RSC stream always closes and the bar and the page share ONE answer —
 * the bar can never stay «unknown» while the body has already rendered the signed-in user.
 */
export type ShellUser = Viewer & { ownedLakesFailed: boolean };
export type UnknownSession = { status: 'unknown' };
export type ViewerState = ShellUser | null | UnknownSession;

export const UNKNOWN_SESSION: UnknownSession = { status: 'unknown' };

/** How long /users/me may take before the session is «unknown» (and the fetch is aborted). */
export const SESSION_READ_MS = 10_000;
/** /feed/owned-lakes: past this the viewer is returned with `ownedLakesFailed`, not held. */
const OWNED_LAKES_READ_MS = 4000;

const meSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  username: z.string(),
  avatar: z.object({ url: z.string() }).nullish(),
  role: z.object({ name: z.string() }).nullish(),
});

const ME_QUERY = { populate: { avatar: { fields: ['url'] }, role: { fields: ['name'] } } };

export const getViewerState = cache(async (): Promise<ViewerState> => {
  if (!(await getSessionToken())) return null;
  const t = createServerTransport();
  try {
    const [me, owned] = await Promise.all([
      call(withDeadline(t, SESSION_READ_MS), { method: 'GET', path: '/users/me', query: ME_QUERY, auth: 'required' }, meSchema),
      readOwnedLakes(withDeadline(t, OWNED_LAKES_READ_MS)),
    ]);
    const role = me.role?.name ?? null;
    return {
      id: me.id,
      documentId: me.documentId,
      username: me.username,
      avatarUrl: me.avatar?.url ?? null,
      role,
      isOrganizer: role === 'Organizer',
      ownedLakes: owned ?? [],
      ownedLakesFailed: owned === null,
    };
  } catch (e) {
    if (isApiError(e) && (e.status === 401 || e.code === 'SESSION_DEAD')) return null;
    // Handled: the bar and the page show their «unknown» state with a retry. Not a console error.
    console.warn('[shell] /users/me failed: session unknown', e);
    return UNKNOWN_SESSION;
  }
});

/** The viewer's lakes, `[]` when they operate none (or have no grant), null when the read failed. */
async function readOwnedLakes(t: Transport): Promise<Viewer['ownedLakes'] | null> {
  try {
    return (await getOwnedLakes(t)).map((l) => ({ documentId: l.documentId, name: l.name }));
  } catch (e) {
    if (isApiError(e) && (e.status === 401 || e.status === 403)) return [];
    // Handled: «Administrare» and Acasă keep a retry row (`ownedLakesFailed`). Not a console error.
    console.warn('[shell] /feed/owned-lakes failed', e);
    return null;
  }
}

/**
 * How long the chrome AND the page wait for the session before they show «unknown» — one deadline
 * for one answer (the bar's retry slot and Acasă's session error flip together, never 6s apart).
 */
export const SHELL_SESSION_TIMEOUT_MS = 4000;

/**
 * The session as the chrome and the pages first show it: getViewerState(), or «unknown» when it has
 * not answered within SHELL_SESSION_TIMEOUT_MS. One per request (React `cache`), so the top bar
 * (SiteShell → ViewerProvider `shell`) and the page (Acasă getHomeSession) share the same timer.
 * `connection()` first: the timer must only run for a real request, never during prerendering
 * (where the read never resolves). The top bar alone upgrades itself later from the full read.
 */
export const getShellSession = cache(async (): Promise<ViewerState> => {
  await connection();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ViewerState>((resolve) => {
    timer = setTimeout(() => resolve(UNKNOWN_SESSION), SHELL_SESSION_TIMEOUT_MS);
  });
  try {
    return await Promise.race([getViewerState(), timeout]);
  } finally {
    clearTimeout(timer);
  }
});

/** Every request gives up after `ms`: the fetch is aborted and the call rejects with a network error. */
function withDeadline(t: Transport, ms: number): Transport {
  return {
    request<T>(req: TransportRequest) {
      const deadline = AbortSignal.timeout(ms);
      const signal = req.signal ? AbortSignal.any([req.signal, deadline]) : deadline;
      const expired = new Promise<never>((_, reject) => {
        const fail = () => reject(networkError(req.path, new Error(`no answer within ${ms} ms`)));
        if (deadline.aborted) fail();
        else deadline.addEventListener('abort', fail, { once: true });
      });
      return Promise.race([t.request<T>({ ...req, signal }), expired]);
    },
  };
}
