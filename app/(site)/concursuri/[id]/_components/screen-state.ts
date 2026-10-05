/*
 * Plain values shared by the server page (page.tsx), error.tsx and the client screen. Not in a
 * 'use client' module: a server component would get a client reference instead of the value.
 */

/** One copy for every «could not load» state of this screen (page.tsx, error.tsx, the client read). */
export const LOAD_ERROR_COPY = 'Ceva nu a mers bine. Încearcă din nou în câteva momente.';

/**
 * fish CompetitionHeader's error line, word for word (parity competition-page.shell.c15): the copy
 * of the «the CMS answered with a shape core cannot read» state.
 */
export const HEADER_ERROR_COPY = 'Ceva nu a mers bine, vă rugăm să încercați din nou mai târziu.';

/**
 * The skeleton's body (CompetitionSkeleton):
 *  - `shell`: loading.tsx, the status is not known yet — the band only;
 *  - `ranking`: started / completed; `preview`: notStarted; `plain`: a ranking type the web cannot draw.
 */
export type SkeletonVariant = 'shell' | 'ranking' | 'preview' | 'plain';

/** The body the page will have, from the status the server read. */
export function skeletonVariantOf(status: string | undefined, unsupported = false): SkeletonVariant {
  if (!status) return 'shell';
  if (status === 'notStarted') return 'preview';
  return unsupported ? 'plain' : 'ranking';
}
