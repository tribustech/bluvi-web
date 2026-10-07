import { captureRoute } from './capture';

/*
 * Partide · Explorează (/partide/exploreaza) on the local CMS data: signed out and signed in as the
 * QA user (no live partidă locally: the finished grid), and the «Prieteni» filter signed out (the
 * filtered-empty state). Live cards, the hint row, the picker states and the errors depend on mocked
 * reads and the clock: tests/e2e/partide-exploreaza.spec.ts covers them. The page loads more finished
 * partide as it scrolls, so captures are of the viewport.
 */
captureRoute({
  name: 'partide-exploreaza',
  path: '/partide/exploreaza',
  states: [
    { name: 'signed-out', fullPage: false },
    { name: 'signed-in', signedIn: true, fullPage: false },
  ],
});

captureRoute({
  name: 'partide-exploreaza-prieteni',
  path: '/partide/exploreaza?filtru=prieteni',
  states: [{ name: 'signed-out', fullPage: false }],
});
