import { appendFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { formatViolations, scanA11y } from './helpers/a11y';
import { A11Y_ROUTES, OPEN_DIALOG, discoverIds, type A11yRoute, type Ids } from './helpers/a11y-routes';
import { BASE_URL } from './helpers/base-url';
import { qaJwt, signIn } from './helpers/session';

/*
 * M8 accessibility audit (parity global.b.a11y-audit, ROADMAP §5/§9): axe-core WCAG 2.0/2.1 A + AA
 * over every route under app/(site) (tests/e2e/helpers/a11y-routes.ts) at 375 and 1280, signed out
 * for public routes and as the QA user for per-user, organizer and operator ones, plus the states
 * each row opens (filters, consent dialog) and the consent banner. Then the keyboard paths: the
 * skip link, the top bar in Tab order, a dialog that traps and restores focus, no ring on a
 * programmatically focused heading (owner rule 8).
 *
 * Read-only: every non-GET through /api/cms is answered locally (never reaches the CMS), Firestore
 * (one shared project for every env) is aborted. Each scan's violations are appended to
 * node_modules/.cache/bluvi-e2e/a11y-audit.jsonl (rule, route, selector, count) for the report.
 */

const WIDTHS = [375, 1280] as const;
const REPORT = join(process.cwd(), 'node_modules/.cache/bluvi-e2e/a11y-audit.jsonl');
const REVIEW = join(process.cwd(), 'node_modules/.cache/bluvi-e2e/a11y-audit-review.jsonl');
const SCANS = join(process.cwd(), 'node_modules/.cache/bluvi-e2e/a11y-audit-scans.jsonl');
const PREVIEW = { name: 'bluvi_consent_preview', value: 'all', domain: new URL(BASE_URL).hostname, path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' as const };

let jwt = '';
let ids: Ids;

test.describe.configure({ timeout: 120_000 });

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  ids = await discoverIds(jwt);
  // The fixture ids this run resolved (the report names them).
  console.log(`a11y-audit ids: ${JSON.stringify(ids)}`);
  mkdirSync(join(process.cwd(), 'node_modules/.cache/bluvi-e2e'), { recursive: true });
});

/** Reads only: writes answered here, Firestore cut off (shared project, no writes from tests). */
async function readOnly(page: Page) {
  await page.route('**/api/cms/**', (route) =>
    route.request().method() === 'GET' ? route.continue() : route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":null}' }),
  );
  await page.route(/firestore\.googleapis\.com/, (route) => route.abort());
}

/** Network quiet (bounded: live pages poll) and finite animations done. */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page
    .waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, { timeout: 5_000 })
    .catch(() => {});
}

function record(route: string, state: string, width: number, violations: Awaited<ReturnType<typeof scanA11y>>['violations']) {
  for (const v of violations) {
    for (const n of v.nodes) {
      appendFileSync(REPORT, `${JSON.stringify({ rule: v.id, impact: v.impact, route, state, width, selector: n.target.join(' '), html: n.html.slice(0, 160) })}\n`);
    }
  }
}

/** One line per scan: where it landed, its h1, how many checks passed and what axe left for review. */
function scanned(route: A11yRoute, width: number, url: string, h1: string | null, r: Awaited<ReturnType<typeof scanA11y>>) {
  const review = r.incomplete.map((i) => `${i.id}×${i.nodes.length}`).join(' ');
  appendFileSync(SCANS, `${JSON.stringify({ route: label(route), width, url: new URL(url).pathname, h1: h1?.trim() ?? null, passes: r.passes.length, violations: r.violations.length, review })}\n`);
  // What axe could not decide (contrast over an image or gradient, text with aria-label…): the manual review list.
  for (const i of r.incomplete) {
    for (const n of i.nodes) {
      const why = [...n.any, ...n.all, ...n.none].map((c) => (c.data as { messageKey?: string } | null)?.messageKey ?? c.id).join(',');
      appendFileSync(REVIEW, `${JSON.stringify({ rule: i.id, route: label(route), width, why, selector: n.target.join(' '), html: n.html.slice(0, 140) })}\n`);
    }
  }
}

test('global.b.a11y-audit — every app/(site) page.tsx has a row in the audit table', () => {
  const root = join(process.cwd(), 'app', '(site)');
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name === 'page.tsx') {
        const segs = relative(root, dir).split(sep).filter((s) => s && !/^\(.*\)$/.test(s));
        found.push(`/${segs.join('/')}`);
      }
    }
  };
  walk(root);
  const covered = new Set(A11Y_ROUTES.map((r) => r.pattern));
  expect(found.filter((p) => !covered.has(p)).sort(), 'routes with no audit row').toEqual([]);
});

const statesFor = (r: A11yRoute, w: number) => {
  const names = (r.states ?? []).filter((s) => !s.widths || s.widths.includes(w)).map((s) => s.name);
  return names.length ? ` + ${names.join(', ')}` : '';
};
const label = (r: A11yRoute) => `${r.pattern} (${r.auth}${r.variant ? `, ${r.variant}` : ''})`;

for (const route of A11Y_ROUTES) {
  for (const width of WIDTHS) {
    test(`global.b.a11y-audit · ${label(route)} · ${width}px — zero axe violations${statesFor(route, width)}`, async ({ page, context }) => {
      const path = route.path(ids);
      test.skip(!path, `no local fixture for ${route.pattern}`);
      await context.addCookies([PREVIEW]);
      if (route.auth !== 'guest') await signIn(context, jwt);
      await readOnly(page);
      await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
      const res = await page.goto(path!, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      expect(res?.status() ?? 0, `${path} answers`).toBeLessThan(500);
      await settle(page);

      // A per-user route must not have bounced to sign-in: the scan is of the screen itself.
      if (route.auth !== 'guest') expect(new URL(page.url()).pathname, 'signed in, not sent to /intra').not.toBe('/intra');

      const reports: string[] = [];
      const results = await scanA11y(page, { exclude: route.exclude });
      scanned(route, width, page.url(), await page.locator('main h1').first().textContent({ timeout: 2_000 }).catch(() => null), results);
      record(route.pattern, 'page', width, results.violations);
      if (results.violations.length) reports.push(`[page ${page.url()}]\n${formatViolations(results.violations)}`);

      for (const state of route.states ?? []) {
        if (state.widths && !state.widths.includes(width)) continue;
        const scope = await state.open(page);
        await settle(page);
        const r = await scanA11y(page, { include: scope ?? undefined, exclude: route.exclude });
        record(route.pattern, state.name, width, r.violations);
        if (r.violations.length) reports.push(`[${state.name}]\n${formatViolations(r.violations)}`);
        await page.keyboard.press('Escape');
        await page.locator(OPEN_DIALOG).locator('visible=true').first().waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
      }
      if (reports.length) await test.info().attach('axe-violations', { body: reports.join('\n\n'), contentType: 'text/plain' });
      expect(reports, reports.join('\n\n')).toEqual([]);
    });
  }
}

test.describe('consent banner (no decision yet)', () => {
  test.use({ storageState: { cookies: [PREVIEW], origins: [] } });

  for (const width of WIDTHS) {
    test(`global.b.a11y-audit · consent banner + preferences dialog · ${width}px — zero axe violations`, async ({ page }) => {
      await readOnly(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const banner = page.getByRole('region', { name: 'Consimțământ cookie-uri' });
      await expect(banner).toBeVisible();
      await settle(page);
      const b = await scanA11y(page);
      record('consent banner', 'banner', width, b.violations);
      expect(b.violations, formatViolations(b.violations)).toEqual([]);
      await banner.getByRole('button', { name: 'Personalizează' }).click();
      await expect(page.getByRole('dialog', { name: 'Setări de confidențialitate' })).toBeVisible();
      await settle(page);
      const d = await scanA11y(page, { include: OPEN_DIALOG });
      record('consent banner', 'preferences dialog', width, d.violations);
      expect(d.violations, formatViolations(d.violations)).toEqual([]);
    });
  }
});

test.describe('keyboard', () => {
  for (const width of WIDTHS) {
    test(`global.b.a11y-audit · ${width}px — Tab: the skip link first, it lands on main; the top bar is next in order`, async ({ page }) => {
      await readOnly(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/balti');
      await settle(page);
      await page.keyboard.press('Tab');
      const skip = page.getByRole('link', { name: 'Sari la conținut' });
      await expect(skip).toBeFocused();
      await expect(skip).toBeVisible();
      // The top bar comes right after the skip link.
      await page.keyboard.press('Tab');
      const inBar = await page.evaluate(() => !!document.activeElement?.closest('header'));
      expect(inBar, 'the second Tab stop is in the top bar').toBe(true);
      // The skip link moves focus into main.
      await skip.focus();
      await page.keyboard.press('Enter');
      await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('main') || document.activeElement?.id === 'continut' || location.hash.length > 1)).toBe(true);
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('main')), 'the next Tab stop after the skip is in main').toBe(true);
    });
  }

  test('global.b.a11y-audit — a dialog (Filtre on /balti) keeps Tab inside, Escape closes it and focus returns to its opener', async ({ page }) => {
    await readOnly(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/balti');
    await settle(page);
    const opener = page.getByRole('button', { name: /^Filtre/ }).locator('visible=true').first();
    await opener.focus();
    await page.keyboard.press('Enter');
    const dlg = page.getByRole('dialog').last();
    await expect(dlg).toBeVisible();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('dialog[open], [role="dialog"]')), `Tab ${i + 1} stays in the dialog`).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog[open], [role="dialog"]'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('global.b.a11y-audit — owner rule 8: a heading focused programmatically after navigation shows no ring', async ({ page }) => {
    await readOnly(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/stiri');
    await settle(page);
    const ring = await page.evaluate(() => {
      const h = document.querySelector('main h1') as HTMLElement | null;
      if (!h) return 'no h1';
      if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
      h.focus();
      const s = getComputedStyle(h);
      return s.outlineStyle === 'none' || s.outlineWidth === '0px' ? 'none' : `${s.outlineStyle} ${s.outlineWidth}`;
    });
    expect(ring).toBe('none');
  });
});
