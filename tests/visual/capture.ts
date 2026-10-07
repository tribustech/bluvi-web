import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { qaJwt, signIn } from '../e2e/helpers/session';

/*
 * captureRoute: one `toHaveScreenshot` per state × width for a route (ROADMAP §5 «Screenshots» at
 * 375 / 768 / 1280 / 1440). Stability:
 *  - fonts: waits for document.fonts.ready;
 *  - motion: animations/transitions disabled by Playwright + a stylesheet that also stops the
 *    LIVE pulse and the skeleton shimmer, and hides the caret / scrollbars;
 *  - lazy images: scrolls the page once top → bottom → top and waits for every <img> to decode;
 *  - dynamic content: masks <time>, [data-visual-mask] and any selector the caller adds (relative
 *    times, countdowns, «acum 3 min», live weights). Mark new dynamic UI with data-visual-mask.
 *
 *   captureRoute({ name: 'acasa', path: '/', states: [{ name: 'signed-out' }, { name: 'signed-in', signedIn: true }] });
 */

export const VISUAL_WIDTHS = [375, 768, 1280, 1440] as const;
const HEIGHT: Record<number, number> = { 375: 812, 768: 1024, 1280: 800, 1440: 900 };

export const DEFAULT_MASKS = ['time', '[data-visual-mask]'];

export interface VisualState {
  /** File-name safe: becomes part of the PNG name. */
  name: string;
  signedIn?: boolean;
  /** Runs after navigation, before the capture (open a tab, scroll to a section…). */
  setup?: (page: Page) => Promise<void>;
  /** Extra selectors to mask for this state. */
  mask?: string[];
  /** Capture the whole page (default) or only the viewport. */
  fullPage?: boolean;
}

export interface CaptureOptions {
  name: string;
  path: string;
  states: VisualState[];
  widths?: readonly number[];
  /** Selectors masked in every state. */
  mask?: string[];
}

const STABILIZE_CSS = `
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
  }
  ::-webkit-scrollbar { display: none !important; }
  html { scrollbar-width: none !important; }
`;

export async function stabilize(page: Page) {
  await page.addStyleTag({ content: STABILIZE_CSS });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  // Pull lazy images in, then come back to the top.
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(async () => {
    await Promise.all(
      // Only rendered images: a lazy <img> inside a display:none subtree (e.g. a ≥1280-only aside)
      // never loads, so its decode() would never settle.
      Array.from(document.images).map((img) =>
        img.complete || img.getClientRects().length === 0 ? null : img.decode().catch(() => null),
      ),
    );
  });
}

async function applyState(context: BrowserContext, state: VisualState, request: Parameters<typeof qaJwt>[0], baseURL?: string) {
  if (state.signedIn) await signIn(context, await qaJwt(request), baseURL);
}

export function captureRoute({ name, path, states, widths = VISUAL_WIDTHS, mask = [] }: CaptureOptions) {
  test.describe(`${name} · ${path}`, () => {
    for (const state of states) {
      for (const width of widths) {
        test(`${state.name} · ${width}px`, async ({ page, context, request, baseURL }) => {
          await page.setViewportSize({ width, height: HEIGHT[width] ?? 900 });
          await applyState(context, state, request, baseURL);
          const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
          expect(res?.status(), `${path} answers 200`).toBe(200);
          await stabilize(page);
          if (state.setup) {
            await state.setup(page);
            await stabilize(page);
          }
          await expect(page).toHaveScreenshot(`${name}-${state.name}-${width}.png`, {
            fullPage: state.fullPage ?? true,
            mask: [...DEFAULT_MASKS, ...mask, ...(state.mask ?? [])].map((s) => page.locator(s)),
          });
        });
      }
    }
  });
}
