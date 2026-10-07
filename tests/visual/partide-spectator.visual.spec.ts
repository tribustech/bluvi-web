import { captureRoute } from './capture';

/*
 * Partidă · spectator view (partide.spectator). A real ENDED public partidă of the local CMS only: a
 * live one changes between runs (catches, the elapsed time), so it belongs in e2e
 * (tests/e2e/partide-spectator.spec.ts, mocked with a fixed clock). Plus the not-found state (an
 * unknown id: the CMS's 404, the same answer a private partidă gets). Override with VISUAL_PARTIDA_ID.
 * Baselines are committed only once the owner approves them (README.md).
 */
const ID = process.env.VISUAL_PARTIDA_ID ?? 'perfseedfq3otnzlrafuws4b';

captureRoute({
  name: 'partide-spectator',
  path: `/partide/${ID}`,
  states: [{ name: 'signed-out' }, { name: 'signed-in', signedIn: true }],
});

captureRoute({
  name: 'partide-spectator-not-found',
  path: '/partide/zzunknownpartida000000001',
  states: [{ name: 'signed-out' }],
});
