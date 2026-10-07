import type { Page } from '@playwright/test';
import { ANGLERS, EMPTY, mockStats, stats, type StatsMock } from '../e2e/partide-clasament.fixtures';
import { servePhotos, setPartideNoPrefetch } from '../e2e/partide-comunitate.fixtures';
import { captureRoute } from './capture';

/*
 * Clasamente (/partide/clasament). The stats come from the e2e's mocks
 * (tests/e2e/partide-clasament.fixtures.ts; the hub's dev-only `noprefetch` cookie leaves the read to
 * the browser), so every state is the same on every run: the full ranking (Pescari, Bălți, Specii),
 * the podium only, the empty period, the error, and from 1280 a row's popover (owner rule 17).
 * Nothing is written anywhere.
 */

const WIDTHS = [375, 1280, 1440, 1920] as const;

const mocked = (mock: StatsMock) => async (page: Page) => {
  await setPartideNoPrefetch(page.context());
  await servePhotos(page);
  await mockStats(page, mock);
};

const FULL = mocked({ month: stats('month') });

captureRoute({
  name: 'partide-clasament',
  path: '/partide/clasament',
  widths: WIDTHS,
  states: [
    { name: 'pescari', prepare: FULL },
    { name: 'podium-only', prepare: mocked({ month: stats('month', { topAnglers: ANGLERS.slice(0, 3) }) }) },
    { name: 'empty', prepare: mocked({ month: EMPTY('month') }) },
    { name: 'error', prepare: mocked({ month: 'error' }) },
  ],
});

captureRoute({
  name: 'partide-clasament-balti',
  path: '/partide/clasament?tab=balti',
  widths: WIDTHS,
  states: [
    { name: 'full', prepare: FULL },
    { name: 'empty', prepare: mocked({ month: stats('month', { topVenues: [], species: [] }) }) },
  ],
});

captureRoute({
  name: 'partide-clasament-specii',
  path: '/partide/clasament?tab=specii',
  widths: WIDTHS,
  states: [{ name: 'full', prepare: FULL }],
});

captureRoute({
  name: 'partide-clasament-popover',
  path: '/partide/clasament',
  widths: [1280, 1440, 1920],
  states: [
    {
      name: 'open',
      prepare: FULL,
      fullPage: false,
      setup: async (page) => {
        await page.getByTestId('angler-rows').locator('tbody tr').first().click({ position: { x: 300, y: 20 } });
        await page.getByRole('dialog').waitFor();
      },
    },
  ],
});
