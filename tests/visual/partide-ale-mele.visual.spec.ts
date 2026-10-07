import type { Page } from '@playwright/test';
import { aleMeleRows, catchesPage, mockMine, type MineMock } from '../e2e/partide-ale-mele.fixtures';
import { captureRoute } from './capture';

/*
 * Partide · Ale mele (/partide/ale-mele). On the local CMS data: signed out (the journal's sign-in
 * wall under the hub's chrome) and signed in as the QA user (no partidă and no catch locally: the
 * empty journal — the zeros' card and «Jurnalul tău de pescuit»).
 *
 * The full journal comes from the e2e's /api/cms mocks (tests/e2e/partide-ale-mele.fixtures.ts:
 * nothing is written anywhere) under a frozen clock, so the chart's months, the running durations
 * and the dock read the same on every run: populated (the bento from 1280, «Capturile mele»,
 * «Statistici», «În desfășurare», «Istoric partide»), populated with a live partidă (the dock below
 * 1280, the left column's card from 1280) and a 40+ character venue (every own card still fits a
 * phone and keeps its three stats). Relative times and running durations also carry
 * data-visual-mask.
 */

/** Thursday 25 September 2026, 12:00 in Bucharest. */
const NOW = Date.UTC(2026, 8, 25, 9, 0);
const R = aleMeleRows(NOW);
const CATCHES = { first: catchesPage(0, 12, 12, null) };

const journal = (mock: MineMock) => async (page: Page) => {
  await page.clock.setFixedTime(NOW);
  await mockMine(page, { ...mock, now: NOW });
};

captureRoute({
  name: 'partide-ale-mele',
  path: '/partide/ale-mele',
  states: [
    { name: 'signed-out' },
    { name: 'signed-in', signedIn: true },
    { name: 'populated', signedIn: true, prepare: journal({ rows: [R.F3, R.OPEN, R.F1, R.F4, R.F2], catches: CATCHES }) },
    { name: 'populated-live', signedIn: true, prepare: journal({ rows: R.ALL, catches: CATCHES, live: true }) },
    { name: 'long-venue', signedIn: true, prepare: journal({ rows: [R.LONG, R.LONG_OPEN, R.F1, R.F2] }) },
  ],
});
