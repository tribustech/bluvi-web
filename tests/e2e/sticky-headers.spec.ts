import { expect, test, type Page } from '@playwright/test';

/*
 * Owner rule 3 (docs/ROADMAP.md §4b, 2026-10-06): a sticky or animated header never floats. On the
 * phone the top bar slides away on scroll down (TopBar `data-concealed`); every row pinned under it
 * (T3 section chips, the competition's tab strip) must follow it to the top edge and come back down
 * with it — never a 56px strip of page between the edge and a row «in the air». From 768 the bar
 * never hides, and the rows sit right under it. Local CMS on :1337; ids as in balta / concurs specs.
 */

const LAKE = process.env.E2E_LAKE_FULL ?? 'g14bobjsal2dbks2jg38v0oi';
const LIVE = process.env.E2E_COMPETITION_LIVE ?? 'kee49a3e64b3f636b4b60daa';

/**
 * `desktop: false` — the row is sticky only below 1280 (from 1280 it scrolls with the page). None
 * today: every list chrome pins at every width (the same list behaves the same).
 * `motion` — also checked frame by frame on reveal (every row is on the shell's UNDER_BAR_TOP timing).
 * The competition's row is T3's pinned band (mini title row + route tabs, components/templates/T3/DetailPinned).
 */
const PINNED: { name: string; path: string; row: string; desktop?: boolean; motion?: boolean }[] = [
  { name: 'Baltă · section chips', path: `/balti/${LAKE}`, row: 'nav[data-t3="chips"]', motion: true },
  { name: 'Concurs · tab strip', path: `/concursuri/${LIVE}`, row: '[data-t3="pinned-band"]', motion: true },
  { name: 'Bălți · list header', path: '/balti', row: '[data-list-chrome]', motion: true },
  { name: 'Concursuri · list chrome', path: '/concursuri', row: '[data-list-chrome]', motion: true },
];

test.describe.configure({ timeout: 120_000 });

async function open(page: Page, path: string, width: number) {
  await page.setViewportSize({ width, height: 740 });
  const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
}

/** Bar bottom (clamped at the edge when it has slid away) and the pinned row's top, after the transitions settle. */
async function geometry(page: Page, row: string, y: number) {
  await page.evaluate(t => window.scrollTo(0, t), y);
  await page.waitForTimeout(700);
  return page.evaluate(sel => {
    const bar = document.querySelector('header')!.getBoundingClientRect();
    const el = document.querySelector<HTMLElement>(sel);
    return { bar: Math.max(0, Math.round(bar.bottom)), row: Math.round(el!.getBoundingClientRect().top), concealed: document.querySelector('header')!.hasAttribute('data-concealed') };
  }, row);
}

/**
 * Samples bar bottom and row top every frame for `ms` after a scroll: on the bar's own timing the
 * two move together, so the row is never tucked under the bar nor left with a gap on the way.
 */
async function track(page: Page, row: string, y: number, ms = 450) {
  return page.evaluate(
    ({ sel, y, ms }) =>
      new Promise<number>(done => {
        let worst = 0;
        const t0 = performance.now();
        window.scrollTo(0, y);
        const tick = () => {
          const bar = Math.max(0, document.querySelector('header')!.getBoundingClientRect().bottom);
          const top = document.querySelector<HTMLElement>(sel)!.getBoundingClientRect().top;
          worst = Math.max(worst, Math.abs(bar - top));
          if (performance.now() - t0 < ms) requestAnimationFrame(tick);
          else done(Math.round(worst));
        };
        requestAnimationFrame(tick);
      }),
    { sel: row, y, ms },
  );
}

for (const { name, path, row, desktop = true, motion = false } of PINNED) {
  test(`sticky · ${name} · 375 — follows the sliding bar, never floats`, async ({ page }) => {
    await open(page, path, 375);
    await expect(page.locator(row).first()).toBeAttached();
    await geometry(page, row, 300);
    const down = await geometry(page, row, 1100);
    expect(down.concealed, 'scrolling down slides the bar away').toBe(true);
    expect(down.row, 'the pinned row takes the top edge').toBe(0);
    const up = await geometry(page, row, 800);
    expect(up.concealed, 'scrolling up brings the bar back').toBe(false);
    expect(up.row, 'the pinned row sits right under the bar').toBe(up.bar);
    // In motion too: down then up again, frame by frame, the row never lags the bar.
    if (!motion) return;
    await geometry(page, row, 1100);
    expect(await track(page, row, 800), 'the row moves with the bar on reveal').toBeLessThanOrEqual(3);
  });

  if (desktop) test(`sticky · ${name} · 1280 — under the bar, which never hides`, async ({ page }) => {
    await open(page, path, 1280);
    await geometry(page, row, 300);
    const down = await geometry(page, row, 1100);
    expect(down.concealed).toBe(false);
    expect(down.row).toBe(down.bar);
  });
}

/*
 * The offline banner is part of the stack: pinned rows sit under it (bar shown or hidden), so it is
 * never painted over by a row nor covers one.
 */
for (const { name, path, row } of PINNED.slice(0, 2)) {
  test(`sticky · ${name} · 375 — the offline banner stacks above the pinned row`, async ({ page, context }) => {
    await open(page, path, 375);
    await context.setOffline(true);
    const stack = async (y: number) => {
      await page.evaluate(t => window.scrollTo(0, t), y);
      await page.waitForTimeout(700);
      return page.evaluate(sel => {
        const banner = document.querySelector('[role="status"] > p')!.getBoundingClientRect();
        const hit = document.elementFromPoint(banner.left + banner.width / 2, banner.top + banner.height / 2);
        return {
          bar: Math.max(0, Math.round(document.querySelector('header')!.getBoundingClientRect().bottom)),
          banner: [Math.round(banner.top), Math.round(banner.bottom)],
          row: Math.round(document.querySelector<HTMLElement>(sel)!.getBoundingClientRect().top),
          visible: !!hit?.closest('[role="status"]'),
        };
      }, row);
    };
    await stack(300);
    for (const s of [await stack(1100), await stack(800)]) {
      expect(s.banner[0], 'the banner sits on the bar').toBe(s.bar);
      expect(s.row, 'the row sits on the banner').toBe(s.banner[1]);
      expect(s.visible, 'nothing paints over the banner').toBe(true);
    }
    await context.setOffline(false);
  });
}

test('sticky · Baltă · 375 — a chip jump lands the section 12px under the pinned rows', async ({ page }) => {
  await open(page, `/balti/${LAKE}`, 375);
  const chips = page.locator('nav[data-t3="chips"] a[data-section]');
  const id = await chips.nth(Math.min(3, (await chips.count()) - 1)).getAttribute('data-section');
  await chips.and(page.locator(`[data-section="${id}"]`)).click();
  await page.waitForTimeout(1500);
  const r = await page.evaluate(id => ({
    nav: Math.round(document.querySelector('nav[data-t3="chips"]')!.getBoundingClientRect().bottom),
    heading: Math.round(document.getElementById(id!)!.getBoundingClientRect().top),
    active: document.querySelector<HTMLElement>('nav[data-t3="chips"] a[aria-current]')?.dataset.section,
  }), id);
  expect(r.heading - r.nav).toBe(12);
  expect(r.active).toBe(id);
});

test('sticky · Baltă · 1280 — bar and pinned row cast one shadow (the row\'s)', async ({ page }) => {
  await open(page, `/balti/${LAKE}`, 1280);
  await page.evaluate(() => window.scrollTo(0, 780));
  await page.waitForTimeout(700);
  const s = await page.evaluate(() => ({
    bar: getComputedStyle(document.querySelector('header')!).boxShadow,
    row: getComputedStyle(document.querySelector('nav[data-t3="chips"]')!).boxShadow,
  }));
  expect(s.bar.replace(/rgba\(0, 0, 0, 0\) 0px 0px 0px 0px,?\s*/g, '').trim()).toBe('');
  expect(s.row).not.toBe('none');
});

/*
 * The pinned mini row (46px) holds everything inside it on both T3 pages: the 44px share chip, the
 * title (never flush with the edge) and the competition's state pill on the title line (never
 * touching the tabs under it). Bar hidden, scrolled past the header.
 */
for (const { name, path } of PINNED.slice(0, 2)) {
  test(`sticky · ${name} · 375 — the mini row fits its contents`, async ({ page }) => {
    await open(page, path, 375);
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(800);
    const m = await page.evaluate(() => {
      const mini = document.querySelector<HTMLElement>('[data-t3="pinned-mini"]')!;
      const r = (el: Element | null) => (el ? el.getBoundingClientRect() : null);
      const row = r(mini)!;
      const kids = [...mini.querySelectorAll('button, span')].map(el => r(el)!).filter(b => b.height > 0);
      return {
        top: row.top,
        bottom: row.bottom,
        minTop: Math.min(...kids.map(b => b.top)),
        maxBottom: Math.max(...kids.map(b => b.bottom)),
        chip: r(mini.querySelector('button'))?.height ?? 0,
        visible: getComputedStyle(mini).opacity,
      };
    });
    expect(m.visible).toBe('1');
    expect(m.top).toBeGreaterThanOrEqual(0);
    expect(m.chip).toBe(44);
    expect(m.minTop - m.top, 'nothing flush with the top edge').toBeGreaterThanOrEqual(1);
    expect(m.bottom - m.maxBottom, 'nothing touching the tabs').toBeGreaterThanOrEqual(1);
  });
}
