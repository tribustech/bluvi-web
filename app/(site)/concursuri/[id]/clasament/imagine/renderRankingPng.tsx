import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { createContext, domToBlob } from 'modern-screenshot';
import type { RankingImageData } from './data/route';
import { RankingSheet } from './png/sheet';

/*
 * The ranking image drawn in the browser (DownloadRankingButton, loaded on its click): the PNG
 * route's own sheet (png/sheet.tsx RankingSheet — inline-styled flexbox, which the DOM lays out as
 * Satori does) from the data route's answer (data/route.ts: the model, tokens and sponsor logos),
 * mounted off screen in the page's Nunito, then rasterised by modern-screenshot (SVG foreignObject →
 * canvas). The sheet's sizes are already in the PNG's pixels (SCALE×), so it is captured at scale 1:
 * the file has the server's size.
 */

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/**
 * The page's upright Nunito (app/fonts.ts, the family --font-nunito names) as @font-face rules with
 * the file inlined, for the rasteriser: the image is drawn from an SVG that cannot load the page's
 * fonts. Only the upright face — the library's own embedding also takes the italic face of the same
 * family (app/globals.css), and Safari then sets the whole sheet in italic. Null when the rule is
 * not readable (the library's embedding is used instead).
 */
async function uprightFontCss(): Promise<string | null> {
  const family = getComputedStyle(document.documentElement).getPropertyValue('--font-nunito').split(',')[0]?.replace(/['"]/g, '').trim();
  if (!family) return null;
  const rules: Promise<string>[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let list: CSSRuleList;
    try {
      list = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(list)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      if (rule.style.getPropertyValue('font-family').replace(/['"]/g, '').trim() !== family) continue;
      if (rule.style.getPropertyValue('font-style') === 'italic') continue;
      const src = /url\((['"]?)([^'")]+)\1\)/.exec(rule.style.getPropertyValue('src'))?.[2];
      if (!src) continue;
      const url = new URL(src, sheet.href ?? document.baseURI).href;
      rules.push(
        fetch(url)
          .then(res => (res.ok ? res.blob() : Promise.reject(new Error(`font ${res.status}`))))
          .then(toDataUrl)
          .then(data => rule.cssText.replace(/url\((['"]?)[^'")]+\1\)/, `url("${data}")`)),
      );
    }
  }
  if (!rules.length) return null;
  return (await Promise.all(rules)).join('\n');
}

/** Safari and every iOS browser (all WebKit; Chrome and Edge on a computer or Android say «Chrome/»). Loaded only in the browser. */
const WEBKIT = /AppleWebKit/.test(navigator.userAgent) && !/Chrome\//.test(navigator.userAgent);
const WEBKIT_REDRAWS = 3;

/** `cn`: the National Championship General sheet (the PNG route's `x-ranking-image: cn`). */
export type RenderedRanking = { blob: Blob; fileName: string; cn: boolean };

/** `empty`: nothing to draw (the data route's EmptyReason); `failed`: anything else. */
export class RankingImageError extends Error {
  constructor(readonly reason: 'empty' | 'failed') {
    super(reason);
  }
}

export async function renderRankingPng(dataUrl: string, signal?: AbortSignal): Promise<RenderedRanking> {
  const res = await fetch(dataUrl, { signal });
  const body = (await res.json().catch(() => null)) as (RankingImageData & { reason?: undefined }) | { reason: string } | null;
  if (!res.ok || !body) throw new RankingImageError('failed');
  if (body.reason !== undefined) throw new RankingImageError('empty');
  const data = body as RankingImageData;

  // Off screen, in the page (its font-face and the --font-nunito variable on <html> apply).
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, { position: 'fixed', top: '0', left: '-100000px', pointerEvents: 'none' });
  document.body.append(host);
  const root = createRoot(host);
  try {
    flushSync(() =>
      root.render(
        <RankingSheet
          model={data.model}
          tokens={data.tokens}
          now={data.now}
          sponsors={data.sponsors}
          width={data.width}
          height={data.height}
          fontFamily="var(--font-nunito)"
        />,
      ),
    );
    const sheet = host.firstElementChild;
    if (!(sheet instanceof HTMLElement)) throw new RankingImageError('failed');
    const [fontCss] = await Promise.all([uprightFontCss().catch(() => null), document.fonts.ready]);
    await Promise.all(Array.from(sheet.querySelectorAll('img'), img => img.decode().catch(() => undefined)));
    const context = await createContext(sheet, {
      width: data.width,
      height: data.height,
      scale: 1,
      type: 'image/png',
      backgroundColor: data.tokens.surface,
      font: fontCss ? { cssText: fontCss } : { preferredFormat: 'woff2' },
    });
    // WebKit decodes the SVG's inlined font only after the first draw, which then comes out in the
    // serif fallback (seen on iOS Safari): draw again a few times. The library counts these redraws
    // for the files it inlines itself, never for `font.cssText`; elsewhere they are skipped.
    if (WEBKIT) context.drawImageCount += WEBKIT_REDRAWS;
    const blob = await domToBlob(context);
    return { blob, fileName: `${data.fileName}.png`, cn: data.model.nc };
  } finally {
    root.unmount();
    host.remove();
  }
}
