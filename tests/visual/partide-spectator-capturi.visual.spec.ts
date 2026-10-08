import { captureRoute } from './capture';

/*
 * Capturile partidei (partide.spectator-capturi, /partide/[id]/capturi). A real ENDED public partidă
 * of the local CMS only (a live one changes between runs; the mocked states — empty, the skeleton,
 * the next page, the lightbox — are in tests/e2e/partide-spectator-capturi.spec.ts), plus the
 * not-found state (an unknown id: the CMS's 404, the same answer a private partidă gets).
 * Override with VISUAL_PARTIDA_ID. Baselines are committed only once the owner approves them.
 */
const ID = process.env.VISUAL_PARTIDA_ID ?? 'perfseedfq3otnzlrafuws4b';
const WIDTHS = [375, 768, 1280, 1440, 1920] as const;

captureRoute({
  name: 'partide-spectator-capturi',
  path: `/partide/${ID}/capturi`,
  widths: WIDTHS,
  states: [{ name: 'signed-out' }, { name: 'signed-in', signedIn: true }],
});

captureRoute({
  name: 'partide-spectator-capturi-not-found',
  path: '/partide/zzunknownpartida000000001/capturi',
  widths: WIDTHS,
  states: [{ name: 'signed-out' }],
});
