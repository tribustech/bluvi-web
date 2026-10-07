import type { Page } from '@playwright/test';
import { routes } from '@/lib/routes';
import { mockMine, type MineMock } from '../e2e/partide-ale-mele.fixtures';
import { historyRows, manyRows } from '../e2e/partide-istoric.fixtures';
import { captureRoute } from './capture';

/*
 * «Istoric partide» (/partide/istoric), signed in as the QA user, on the e2e's /api/cms mocks
 * (tests/e2e/partide-istoric.fixtures.ts: absolute dates, nothing written anywhere): the months
 * (default), «Greutate», a venue + «Cu capturi» filter, the empty result after filtering, no
 * finished partidă at all, a failed read, and a long history (the first window of 10).
 * The skeleton is asserted by the e2e (c7): a screenshot waits for the network to settle.
 */

const R = historyRows();
const WIDTHS = [375, 768, 1280, 1440, 1920] as const;
const mine = (mock: MineMock) => async (page: Page) => {
  await mockMine(page, mock);
};

captureRoute({
  name: 'partide-istoric',
  path: routes.partideHistory(),
  widths: WIDTHS,
  states: [
    { name: 'months', signedIn: true, prepare: mine({ rows: R.ALL }) },
    { name: 'none-finished', signedIn: true, prepare: mine({ rows: [R.OPEN] }) },
    { name: 'error', signedIn: true, prepare: mine({ rows: 'error' }) },
    { name: 'many', signedIn: true, prepare: mine({ rows: manyRows(25) }) },
  ],
});

captureRoute({
  name: 'partide-istoric-greutate',
  path: routes.partideHistory({ byWeight: true }),
  widths: WIDTHS,
  states: [{ name: 'weight', signedIn: true, prepare: mine({ rows: R.ALL }) }],
});

captureRoute({
  name: 'partide-istoric-filtre',
  path: routes.partideHistory({ venues: ['Balta Chita', 'Lacul Snagov'], withCaptures: true }),
  widths: WIDTHS,
  states: [{ name: 'venues-captures', signedIn: true, prepare: mine({ rows: R.ALL }) }],
});

captureRoute({
  name: 'partide-istoric-gol',
  path: routes.partideHistory({ venues: ['Balta Dridu'], withCaptures: true }),
  widths: WIDTHS,
  states: [{ name: 'filtered-empty', signedIn: true, prepare: mine({ rows: R.ALL }) }],
});
