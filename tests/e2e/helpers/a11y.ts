import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/*
 * ROADMAP §5 «Accessibility»: axe-core, WCAG 2.0/2.1 A + AA, zero violations. Call it from every
 * e2e spec once the screen has settled (after the content assertions, before the console check):
 *
 *   await expectNoA11yViolations(page);
 *
 * Elements hidden at the current width (display:none, the other breakpoint's column) are skipped
 * by axe itself. `exclude` takes selectors for third-party frames we cannot fix; every entry needs
 * a comment at the call site. `disableRules` is for a rule that is wrong for a specific screen —
 * same rule: a comment saying why.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

export interface A11yOptions {
  /** CSS selectors to leave out of the scan. */
  exclude?: string[];
  /** axe rule ids to switch off for this scan. */
  disableRules?: string[];
  /** Scan only this part of the page. */
  include?: string;
}

export async function scanA11y(page: Page, options: A11yOptions = {}) {
  let builder = new AxeBuilder({ page }).withTags(TAGS);
  if (options.include) builder = builder.include(options.include);
  for (const sel of options.exclude ?? []) builder = builder.exclude(sel);
  if (options.disableRules?.length) builder = builder.disableRules(options.disableRules);
  return builder.analyze();
}

/** One line per failing node: «rule (impact) · selector · detail». Contrast lines carry fg/bg/ratio. */
export function formatViolations(violations: Awaited<ReturnType<typeof scanA11y>>['violations']) {
  return violations
    .flatMap((v) =>
      v.nodes.map((n) => {
        const data = n.any.find((c) => c.data && typeof c.data === 'object' && 'contrastRatio' in c.data)?.data as
          | { fgColor: string; bgColor: string; contrastRatio: number; expectedContrastRatio: string }
          | undefined;
        const detail = data
          ? `${data.fgColor} on ${data.bgColor} = ${data.contrastRatio}:1 (needs ${data.expectedContrastRatio})`
          : (n.failureSummary ?? v.help).replace(/\s+/g, ' ').trim();
        const text = n.html.replace(/\s+/g, ' ').slice(0, 120);
        return `${v.id} (${v.impact ?? 'n/a'}) · ${n.target.join(' ')} · ${detail} · ${text}`;
      }),
    )
    .join('\n');
}

/**
 * The phone ranking tables (below 768) are fish's own tables in fish's own colours (owner
 * 2026-10-10, ROADMAP §4b.25; the deviations are listed in app/globals.css «the PHONE ranking
 * tables»): inside [data-fish-colours] (the tables and their pills) every rule runs except colour contrast.
 */
const FISH_TABLE = '[data-fish-colours]';

export async function expectNoA11yViolations(page: Page, options: A11yOptions = {}) {
  const results = await scanA11y(page, { ...options, exclude: [...(options.exclude ?? []), FISH_TABLE] });
  if (!options.include && (await page.locator(`${FISH_TABLE}:visible`).count()) > 0) {
    const fish = await scanA11y(page, { include: FISH_TABLE, disableRules: [...(options.disableRules ?? []), 'color-contrast'] });
    results.violations.push(...fish.violations);
  }
  const report = formatViolations(results.violations);
  if (report) {
    await test.info().attach('axe-violations', { body: report, contentType: 'text/plain' });
  }
  expect(results.violations, `axe WCAG 2.1 AA violations:\n${report}`).toEqual([]);
}
