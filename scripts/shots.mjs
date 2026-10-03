// Screenshot harness for design ↔ implementation comparison (headless Playwright Chromium).
//
//   npm run shots -- design Concurs              → .shots/design-Concurs.png (whole canvas)
//   npm run shots -- app /concursuri/abc          → .shots/app-concursuri-abc-{375,768,1280,1440}.png
//   npm run shots -- app /dev/kit --widths 375,1440 --base http://localhost:3000
//
// `design` serves design/ itself; `app` expects the Next server to be running (default :3000).
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { serveStatic } from './serve-static.mjs';

const [kind, target, ...rest] = process.argv.slice(2);
const opt = (name, def) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : def;
};
const OUT = path.resolve('.shots');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
try {
  if (kind === 'design') {
    const server = await serveStatic(path.resolve('design'), 4301);
    const page = await browser.newPage({ viewport: { width: Number(opt('width', 1800)), height: 1200 }, deviceScaleFactor: 1 });
    await page.goto(`http://localhost:4301/${encodeURIComponent(`${target}.dc.html`)}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const file = path.join(OUT, `design-${target.replace(/\W+/g, '_')}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
    server.close();
  } else if (kind === 'app') {
    const base = opt('base', 'http://localhost:3000');
    const widths = opt('widths', '375,768,1280,1440').split(',').map(Number);
    const cookie = opt('cookie');
    for (const w of widths) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: w < 768 ? 2 : 1 });
      if (cookie) await ctx.addCookies([{ name: 'bluvi_session', value: cookie, url: base }]);
      const page = await ctx.newPage();
      // Not 'networkidle': the dev server's HMR socket keeps the network busy and times it out.
      await page.goto(`${base}${target}`, { waitUntil: 'load' });
      await page.waitForLoadState('domcontentloaded');
      await page.evaluate(() => document.fonts.ready);
      // Scroll through the page so lazy images and anything viewport-triggered load before the capture.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
          window.scrollTo(0, y);
          await new Promise(r => setTimeout(r, 120));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
      const file = path.join(OUT, `app${target.replace(/\W+/g, '_')}-${w}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
      await ctx.close();
    }
  } else {
    console.error('usage: shots design <Name> | shots app <path> [--widths a,b] [--base url] [--cookie jwt]');
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
