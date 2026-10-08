import 'server-only';
import { requireViewer } from './require-viewer';
import type { Viewer } from './viewer';

/**
 * What an organizer page's gate decided (organizer.b.role-gate).
 *  - `allowed`: the viewer's role is Organizer (fish `profile.role.name === 'Organizer'`,
 *    core isOrganizerProfile) — render the page; its reads go out with `isOrganizer: true`.
 *  - otherwise: a signed-in viewer without the role — render <OrganizerRoleGate> (a neutral T5
 *    page-state card with a way home), never the panel, never a crash, and make NO organizer read
 *    (fish gates every query on the role: skipToken).
 */
export type OrganizerGate = { allowed: true; viewer: Viewer } | { allowed: false; viewer: Viewer };

/**
 * THE gate of every M6 organizer page (/organizator, the wizard, a competition's management pages),
 * on top of requireViewer (account.b.signed-out-gate) — same contract and the same place to call it
 * (awaited inside a <Suspense> boundary, `next` = the page's own path with its query):
 *  - signed out (no cookie: proxy.ts 307 first; a dead cookie: here) → /intra?next=<next>;
 *  - session unknown (CMS down / slow) → SessionUnknownError → the route's error.tsx;
 *  - signed in → `{ allowed, viewer }`.
 *
 *   async function Gated() {
 *     const gate = await requireOrganizer(routes.organizer());
 *     if (!gate.allowed) return <OrganizerRoleGate />;
 *     return <Screen />;
 *   }
 *
 * The role is the users-permissions role the shell already reads (/users/me, React-cached per
 * request). Pages that also need the competition's AUTHOR check it on top (the CMS stays the
 * authority: its organizer routes answer 403 to anyone else).
 */
export async function requireOrganizer(next: string): Promise<OrganizerGate> {
  const viewer = await requireViewer(next);
  return viewer.isOrganizer ? { allowed: true, viewer } : { allowed: false, viewer };
}
