/*
 * The «Listă» / «Afiș» value and its cookie — no directive, so the server page (which reads the
 * cookie) and the client hook (./density.ts, which writes it) share one definition.
 */

export type Density = 'compact' | 'expanded';

/** The server's copy of the choice (read by app/(site)/concursuri/page.tsx). */
export const DENSITY_COOKIE = 'bluvi_competition_density';

export function parseDensity(value: string | null | undefined): Density | null {
  return value === 'expanded' || value === 'compact' ? value : null;
}
