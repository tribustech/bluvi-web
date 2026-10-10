import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * og:image / twitter:image on every page that sets its own `openGraph` / `twitter` (parity
 * global.b.seo-og-images). Next merges the metadata of a route's segments SHALLOWLY: a page whose
 * metadata sets `openGraph` replaces the parent segment's whole `openGraph`, images included, and a
 * file-based image (opengraph-image.tsx / twitter-image.tsx) is only merged into the metadata of the
 * segment it sits in (next/dist/lib/metadata/resolve-metadata.js mergeStaticMetadata). So a page one
 * segment below its image — a route group like partide/(hub) or pescari/[id]/(profil), or a subpage
 * with no image of its own — shipped without og:image (2026-10-10).
 *
 * The rule: a page.tsx whose metadata (its own source, or a local module it imports) sets `openGraph`
 * or `twitter` has opengraph-image.* AND twitter-image.* in its own directory. The e2e
 * (tests/e2e/og-images.spec.ts) checks the rendered HTML on the key routes.
 */

const ROOT = path.resolve(__dirname, '../..');
const APP = path.join(ROOT, 'app');
const SETS = /\b(openGraph|twitter)\s*:/;

function pages(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) pages(p, out);
    else if (e.name === 'page.tsx') out.push(p);
  }
  return out;
}

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? path.join(ROOT, spec.slice(2)) : path.resolve(path.dirname(from), spec);
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

/** The page's source and the local (app/) modules it imports — where its metadata is built. */
function metadataSources(page: string): string[] {
  const src = fs.readFileSync(page, 'utf8');
  const out = [src];
  for (const m of src.matchAll(/from\s+'((?:\.\.?\/|@\/app\/)[^']+)'/g)) {
    const file = resolveImport(page, m[1]);
    if (file) out.push(fs.readFileSync(file, 'utf8'));
  }
  return out;
}

const hasImage = (dir: string, name: string) => fs.readdirSync(dir).some(f => /^(.+)\.(tsx|ts|jsx|js|png|jpg|jpeg|gif)$/.exec(f)?.[1] === name);

describe('og/twitter images sit next to every page that sets openGraph or twitter', () => {
  const all = pages(path.join(APP, '(site)'));
  const setting = all.filter(p => metadataSources(p).some(s => SETS.test(s) && /\bmetadata\b|generateMetadata/i.test(s)));

  it('finds the pages that set openGraph (the scan works)', () => {
    expect(setting.length).toBeGreaterThan(15);
    const rel = setting.map(p => path.relative(APP, p));
    expect(rel).toContain(path.join('(site)', 'partide', '(hub)', 'page.tsx'));
    expect(rel).toContain(path.join('(site)', 'pescari', '[id]', '(profil)', 'page.tsx'));
  });

  it.each(setting.map(p => [path.relative(APP, p)]))('%s', rel => {
    const dir = path.dirname(path.join(APP, rel));
    expect(hasImage(dir, 'opengraph-image'), `${path.dirname(rel)}/opengraph-image.tsx`).toBe(true);
    expect(hasImage(dir, 'twitter-image'), `${path.dirname(rel)}/twitter-image.tsx`).toBe(true);
  });
});
