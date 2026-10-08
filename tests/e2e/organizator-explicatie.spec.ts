import { mkdirSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import { RANKING_EXPLANATIONS } from '../../core/organizer';
import { expectNoA11yViolations as scan } from './helpers/a11y';
import { expect, signInOrganizer, test } from './helpers/fake-organizer';

/*
 * organizer.ranking-explanation (c1–c3) + organizer.step-ranking.c11 (the panel body) + behaviour
 * organizer.b.ranking-explanation-orphan — the explanation panel over step 3 «Tip clasament»,
 * deep-linkable as /organizator/concursuri/nou/clasament?explicatie=<quantity | mod-general-<type> |
 * grila[-<type>]> (fish create-competition/ranking-explanation.tsx, the orphan screen, and
 * step-ranking.tsx:136-196 / 596-634, the in-page sheet).
 *
 * NO WRITES: the panel reads nothing from the CMS (the explanations are core constants); a new,
 * unnamed wizard never auto-saves. The harness guard fails the test on any write attempt anyway.
 */

test.describe.configure({ timeout: 180_000 });

const PHONE = { width: 375, height: 812 };
const LAPTOP = { width: 1280, height: 900 };
const WIDTHS = [375, 1280, 1440, 1920];
const SHOTS = '.shots/organizator-explicatie';
mkdirSync(SHOTS, { recursive: true });

const URL = (explicatie?: string) => `/organizator/concursuri/nou/clasament${explicatie ? `?explicatie=${encodeURIComponent(explicatie)}` : ''}`;

test.beforeEach(async ({ context, request }) => {
  await signInOrganizer(context, request);
});

/** The kit surface (Sheet <768 / wide Dialog ≥768, intent `reading`) holding the explanation body. */
const body = (page: Page) => page.getByTestId('ranking-explanation-body');
const panel = (page: Page) => page.locator('dialog[open]').filter({ has: body(page) });
const title = (page: Page) => panel(page).getByRole('heading', { level: 2 });
const sections = (page: Page) => panel(page).getByTestId('ranking-explanation-section');
const headings = (page: Page) => body(page).locator('h3, h4');
const URL_PATH = '/organizator/concursuri/nou/clasament';

async function open(page: Page, explicatie: string | undefined, viewport = LAPTOP) {
  await page.setViewportSize(viewport);
  await page.goto(URL(explicatie), { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByTestId('wizard-step')).toHaveAttribute('data-step', 'clasament', { timeout: 90_000 });
  if (explicatie) await expect(panel(page)).toBeVisible({ timeout: 30_000 });
}

async function settle(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    ),
  );
  await page.waitForTimeout(250);
}

/** The state at every owner width (375 / 1280 / 1440 / 1920): the viewport (the panel is a top-layer surface). */
async function shots(page: Page, name: string) {
  const before = page.viewportSize();
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
    await settle(page);
    await page.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
  }
  if (before) await page.setViewportSize(before);
}

/** Section bodies as the page shows them (labels and paragraphs), whitespace-normalised. */
async function sectionTexts(list: Locator) {
  return (await list.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
}
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/* ============================================================================================== */

test('organizer.ranking-explanation.c1 c2 — by URL, a known type: its title, then every section (heading + body) in order', async ({ page, organizer }) => {
  await open(page, 'quantity');
  const src = RANKING_EXPLANATIONS.quantity;
  await expect(body(page)).toHaveAttribute('data-surface', 'dialog');
  await expect(panel(page).getByText('Tip de clasament', { exact: true })).toBeVisible();
  await expect(panel(page)).toHaveAccessibleName(src.title);
  await expect(title(page)).toHaveText(src.title);
  await expect(sections(page)).toHaveCount(src.sections.length);
  await expect(headings(page)).toHaveText(src.sections.map((s) => s.heading!));
  const texts = await sectionTexts(sections(page));
  src.sections.forEach((s, i) => {
    expect(texts[i].startsWith(norm(s.heading!))).toBe(true);
    expect(texts[i]).toContain(norm(s.body));
  });
  // Line breaks of the body survive (numbered steps on their own lines).
  await expect(sections(page).nth(1).getByText(/^1\. Se adună/)).toHaveCSS('white-space', 'pre-line');

  // Focus lands on the title, with no ring (owner rule 8).
  await expect(title(page)).toBeFocused();
  await expect(title(page)).toHaveCSS('outline-style', 'none');

  // A long read: the text column stays ≤ 720 px at 1920.
  await page.setViewportSize({ width: 1920, height: 1000 });
  const box = await body(page).boundingBox();
  expect(box!.width).toBeLessThanOrEqual(720);
  expect(box!.width).toBeGreaterThan(600);

  await settle(page);
  await scan(page);
  await shots(page, 'known-quantity');
  expect(organizer.writes).toEqual([]);
});

test('organizer.ranking-explanation.c3 — by URL, an unknown type: «Necunoscut» / «Tip de clasament necunoscut.» (phone sheet)', async ({ page }) => {
  await open(page, 'nuExista', PHONE);
  await expect(body(page)).toHaveAttribute('data-surface', 'sheet');
  await expect(title(page)).toHaveText('Necunoscut');
  // No eyebrow over an unknown (rule 4).
  await expect(panel(page).getByText('Tip de clasament', { exact: true })).toHaveCount(0);
  await expect(sections(page)).toHaveCount(1);
  await expect(headings(page)).toHaveCount(0);
  await expect(sections(page)).toHaveText('Tip de clasament necunoscut.');
  await expect(title(page)).toBeFocused();
  await settle(page);
  await scan(page);
  await shots(page, 'unknown');
});

test('organizer.step-ranking.c11 — the general-mode group: «1. 📊 După poziția în sector», «1.n …», «2. 🔢 După punctaj»', async ({ page }) => {
  await open(page, 'mod-general-quantityQuality', PHONE);
  await expect(title(page)).toHaveText('Cum funcționează departajarea la Cantitate/Calitate');
  await expect(headings(page)).toHaveText([
    '1. 📊 După poziția în sector',
    '1.1 ⚖️ După poziția în sector, primează Cantitatea',
    '1.2 🐟 După poziția în sector, primează Calitatea',
    '2. 🔢 După punctaj',
  ]);
  await expect(sections(page).nth(1)).toContainText('Cum funcționează');
  await expect(sections(page).nth(1)).toContainText('Exemplu concret');
  // The body scrolls inside the sheet; the page behind does not.
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden');
  await settle(page);
  await scan(page);
  await shots(page, 'general-mode');
});

test('organizer.step-ranking.c11 — the grid rule (of a given type) and a type without a general mode', async ({ page }) => {
  await open(page, 'grila-quality');
  await expect(title(page)).toHaveText('🔀 Regula departajare standuri fără grilă');
  await expect(headings(page)).toHaveText([
    'Ce înseamnă "grilă"?',
    'Când se aplică regula',
    '🐟 După numărul de capturi',
    '📏 După media greutății',
    'Exemplu concret — La Calitate',
    'Cazuri speciale',
  ]);
  await shots(page, 'grid-rule');

  // A concept the type does not have (or an unknown type): «Necunoscut», never a confident explanation.
  for (const explicatie of ['mod-general-bestOf', 'grila-quantity', 'grila-nuExista']) {
    await open(page, explicatie);
    await expect(title(page), explicatie).toHaveText('Necunoscut');
    await expect(sections(page), explicatie).toHaveText('Tip de clasament necunoscut.');
    await expect(panel(page).getByText(/Clasament general|Regula grilei/), explicatie).toHaveCount(0);
  }
});

test('an Object.prototype name in ?explicatie= reads «Necunoscut»; the wizard stays up', async ({ page }) => {
  for (const explicatie of ['constructor', 'grila-constructor', 'mod-general-__proto__']) {
    await open(page, explicatie);
    await expect(title(page), explicatie).toHaveText('Necunoscut');
    await expect(panel(page), explicatie).not.toContainText('native code');
    await expect(page.getByTestId('wizard-step')).toHaveAttribute('data-step', 'clasament');
  }
});

test('opened from «Vezi explicația completă», closing goes back to the step entry: the next Back leaves the step (no dead Back)', async ({ page, organizer }) => {
  await page.setViewportSize(LAPTOP);
  await page.goto('/organizator/concursuri/nou/detalii', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByTestId('wizard-step')).toHaveAttribute('data-step', 'detalii', { timeout: 90_000 });
  await open(page, undefined);
  await page.getByRole('radiogroup', { name: 'Tipul clasamentului' }).locator('label').filter({ has: page.locator('#clasament-quantity') }).click();
  await expect(page.locator('#clasament-quantity')).toBeChecked();
  const length = await page.evaluate(() => history.length);

  for (let round = 0; round < 2; round++) {
    await page.getByRole('button', { name: 'Vezi explicația completă' }).first().click();
    await expect(title(page)).toHaveText(RANKING_EXPLANATIONS.quantity.title);
    expect(new globalThis.URL(page.url()).searchParams.get('explicatie')).toBe('quantity');
    await panel(page).getByRole('button', { name: 'Închide' }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect.poll(() => new globalThis.URL(page.url()).searchParams.has('explicatie')).toBe(false);
    expect(new globalThis.URL(page.url()).pathname).toBe(URL_PATH);
    await expect(page.locator('#clasament-quantity')).toBeChecked();
  }
  // Two reads leave ONE forward entry (the last read), not two stacked «clasament» entries.
  expect(await page.evaluate(() => history.length)).toBe(length + 1);
  // Back now leaves «clasament» for the previous page.
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => new globalThis.URL(page.url()).pathname, { timeout: 30_000 }).toBe('/organizator/concursuri/nou/detalii');
  expect(organizer.writes).toEqual([]);
});

test('closing (X, «Am înțeles», Escape, scrim) removes ?explicatie= without a new history entry; the step stays', async ({ page, organizer }) => {
  for (const [how, viewport] of [
    ['x', LAPTOP],
    ['button', PHONE],
    ['escape', LAPTOP],
    ['scrim', LAPTOP],
  ] as const) {
    await open(page, 'quality', viewport);
    const length = await page.evaluate(() => history.length);
    if (how === 'x') await panel(page).getByRole('button', { name: 'Închide' }).click();
    if (how === 'button') await panel(page).getByRole('button', { name: 'Am înțeles' }).click();
    if (how === 'escape') await page.keyboard.press('Escape');
    if (how === 'scrim') await page.mouse.click(40, 450);
    await expect(panel(page)).toHaveCount(0);
    await expect.poll(() => new globalThis.URL(page.url()).searchParams.has('explicatie'), { message: how }).toBe(false);
    expect(new globalThis.URL(page.url()).pathname).toBe('/organizator/concursuri/nou/clasament');
    expect(await page.evaluate(() => history.length), how).toBe(length);
    await expect(page.getByTestId('wizard-step')).toHaveAttribute('data-step', 'clasament');
    expect(await page.evaluate(() => document.documentElement.style.overflow), how).toBe('');
  }
  expect(organizer.writes).toEqual([]);
});

test('organizer.b.ranking-explanation-orphan — keyboard: focus stays in the panel; Tab reaches X and «Am înțeles»', async ({ page }) => {
  await open(page, 'quantity');
  await expect(title(page)).toBeFocused();
  const seen = new Set<string>();
  // Title → X → (the scrollable body) → «Am înțeles» (the native modal keeps the page behind inert).
  for (let i = 0; i < 4 && !seen.has('Am înțeles'); i++) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => Boolean(document.activeElement?.closest('dialog[open]')?.querySelector('[data-testid="ranking-explanation-body"]')));
    expect(inside).toBe(true);
    seen.add(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim() || ''));
  }
  expect([...seen][0]).toBe('Închide');
  expect([...seen].at(-1)).toBe('Am înțeles');
  await expect(page.locator(':focus')).toHaveText('Am înțeles');
  await page.keyboard.press('Escape');
  await expect(panel(page)).toHaveCount(0);
});
