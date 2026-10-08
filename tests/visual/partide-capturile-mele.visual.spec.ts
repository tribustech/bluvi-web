import type { Page } from '@playwright/test';
import { routes } from '@/lib/routes';
import { catchesPage, mockMine, type MineMock } from '../e2e/partide-ale-mele.fixtures';
import { captureRoute } from './capture';

/*
 * «Capturile mele» (/partide/capturile-mele), signed in as the QA user, on the e2e's /api/cms mocks
 * (tests/e2e/partide-ale-mele.fixtures.ts: catch 1 is a competition catch, nothing written
 * anywhere): a full first page, a few photos, one, none, a failed read, the lightbox and the share
 * card of the competition catch. The skeleton is asserted by the e2e (c3): a screenshot waits for
 * the network to settle.
 */

const WIDTHS = [375, 768, 1280, 1440, 1920] as const;
const mine = (mock: MineMock) => async (page: Page) => {
  await mockMine(page, mock);
};
/** Every third photo a portrait (1200×1600): the masonry staggers its columns. */
const staggered = (p: ReturnType<typeof catchesPage>) => ({
  ...p,
  data: p.data.map((c, i) => (i % 3 === 0 ? { ...c, photoWidth: 1200, photoHeight: 1600 } : c)),
});
const MANY = { first: staggered(catchesPage(0, 20, 25, 'c2')), c2: staggered(catchesPage(20, 5, 25, null)) };

async function failingCatches(page: Page) {
  await mockMine(page, { rows: [] });
  await page.route(/\/api\/cms\/feed\/sessions\/mine\/catches/, route =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"status":500}}' }),
  );
}

async function openLightbox(page: Page) {
  await page.getByTestId('my-catches-grid').getByRole('button').nth(1).click();
  await page.getByRole('dialog', { name: /^Captura 2 din/ }).waitFor();
}

captureRoute({
  name: 'partide-capturile-mele',
  path: routes.myCatches(),
  widths: WIDTHS,
  states: [
    { name: 'photos', signedIn: true, prepare: mine({ rows: [], catches: MANY }) },
    { name: 'few', signedIn: true, prepare: mine({ rows: [], catches: { first: catchesPage(0, 3, 3, null) } }) },
    { name: 'one', signedIn: true, prepare: mine({ rows: [], catches: { first: catchesPage(0, 1, 1, null) } }) },
    { name: 'empty', signedIn: true, prepare: mine({ rows: [], catches: {} }) },
    {
      name: 'error',
      signedIn: true,
      prepare: failingCatches,
      setup: async page => {
        await page.getByText('Capturile nu s-au putut încărca.').waitFor({ timeout: 45_000 });
      },
    },
    { name: 'lightbox', signedIn: true, fullPage: false, prepare: mine({ rows: [], catches: MANY }), setup: openLightbox },
    {
      name: 'share',
      signedIn: true,
      fullPage: false,
      prepare: mine({ rows: [], catches: MANY }),
      setup: async page => {
        await openLightbox(page);
        await page.getByRole('button', { name: 'Distribuie captura' }).click();
        await page.getByRole('dialog', { name: 'Distribuie captura' }).getByRole('img').waitFor();
        await page.waitForTimeout(600);
      },
    },
  ],
});

/*
 * A beginner's gallery (1–4 catches, the most common landing) on the widest band: four photos at
 * 1920. Owner rule 5 wants the grid to either span the band or sit centred under the header; the
 * shared Masonry (app/(site)/balti/[id]/_sub/Masonry.tsx, the lake gallery's) still caps it at
 * ~360px a column, left-aligned — raised with its owner, and this baseline is re-taken with that fix.
 */
captureRoute({
  name: 'partide-capturile-mele',
  path: routes.myCatches(),
  widths: [1920],
  states: [{ name: 'beginner', signedIn: true, prepare: mine({ rows: [], catches: { first: staggered(catchesPage(0, 4, 4, null)) } }) }],
});
