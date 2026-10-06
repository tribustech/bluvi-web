import type { ConsoleMessage, Page } from '@playwright/test';

/*
 * The console check every e2e spec runs (ROADMAP: no console errors): console.error lines and
 * uncaught page errors, collected from the moment it is called. `ignore` is the spec's own
 * allow-list — each pattern with a comment at the call site saying why it is not the page's defect.
 * `warnings: true` also collects console.warning lines (prefixed «warning: », errors «error: »).
 *
 * Always dropped, and nothing broader: React's dev-only Performance Tracks error
 * «Failed to execute 'measure' on 'Performance': '​<Component> [Prerender]' cannot have a negative
 * time stamp.» — React 19 development builds measure server-component timings against the page's
 * time origin and throw it when the two clocks disagree; production builds never emit it.
 */
const REACT_DEV_MEASURE = /Failed to execute 'measure' on 'Performance': .* cannot have a negative time stamp/;

export type ConsoleWatchOptions = { ignore?: RegExp | readonly RegExp[]; warnings?: boolean };

export function collectConsoleErrors(page: Page, { ignore, warnings = false }: ConsoleWatchOptions = {}): string[] {
  const allow = ignore === undefined ? [] : Array.isArray(ignore) ? ignore : [ignore as RegExp];
  const keep = (text: string) => !REACT_DEV_MEASURE.test(text) && !allow.some((r) => r.test(text));
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    const type = msg.type();
    if (type !== 'error' && !(warnings && type === 'warning')) return;
    if (!keep(msg.text())) return;
    errors.push(warnings ? `${type}: ${msg.text()}` : msg.text());
  });
  page.on('pageerror', (err) => {
    if (keep(err.message)) errors.push(`pageerror: ${err.message}`);
  });
  return errors;
}
