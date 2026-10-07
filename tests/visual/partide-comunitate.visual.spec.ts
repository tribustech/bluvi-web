import { captureRoute } from './capture';

/*
 * Partide · Comunitate (/partide) on the local CMS data: signed out (hero, quick nav, the finished
 * fallback, the records' invitation tiles, Locuri populare) and signed in as the QA user (no live
 * partidă locally: the same body, the hero without the sign-in detour). The live / duel /
 * leaderboard / dock states depend on mocked reads and the clock: they are covered by
 * tests/e2e/partide-comunitate.spec.ts, not by a pixel baseline. Relative times carry
 * data-visual-mask.
 */
captureRoute({
  name: 'partide-comunitate',
  path: '/partide',
  states: [{ name: 'signed-out' }, { name: 'signed-in', signedIn: true }],
});
