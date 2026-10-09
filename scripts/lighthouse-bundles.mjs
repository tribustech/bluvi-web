#!/usr/bin/env node
/**
 * First-load JS per route of a production build (M8-B4, global.b.performance-audit). Next 16's build
 * output no longer prints sizes, so this reads the client reference manifests: a route's first load
 * is the root main files plus the entry chunks of its page and every layout above it (gzip bytes,
 * what a browser downloads). It also flags the heavy libraries that must stay route-scoped and
 * lazy (maplibre-gl, supercluster, tiptap / prosemirror, firebase, gifenc): none may sit in the
 * first load of a public page.
 *
 *   node scripts/lighthouse-bundles.mjs [.next-m8-perf] [--json]
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const args = process.argv.slice(2);
const dist = path.resolve(args.find((a) => !a.startsWith('--')) ?? '.next');

/** The audited routes (lighthouserc.json) → their app/ page segment. */
const ROUTES = {
  '/': '(site)/page',
  '/balti': '(site)/balti/page',
  '/balti/[id]': '(site)/balti/[id]/page',
  '/balti/harta': '(site)/balti/harta/page',
  '/concursuri': '(site)/concursuri/page',
  '/concursuri/[id]': '(site)/concursuri/[id]/page',
  '/concursuri/[id]/clasament': '(site)/concursuri/[id]/clasament/page',
  '/ape-publice': '(site)/ape-publice/page',
  '/stiri': '(site)/stiri/page',
  '/stiri/[id]': '(site)/stiri/[id]/page',
  '/partide': '(site)/partide/(hub)/page',
  '/partide/[id]': '(site)/partide/[id]/page',
};

/**
 * A string only the library's own code carries (a bare mention — a dynamic import's chunk name, a
 * CSS class — is not the library). Checked on the 2026-10-09 build: each matches the lazy chunk
 * that holds the library and nothing else.
 */
const HEAVY = {
  'maplibre-gl': /MapLibre/,
  supercluster: /getClusterExpansionZoom/,
  tiptap: /ProseMirror/,
  firebase: /@firebase\/app/,
  gifenc: /writeFrame/,
};

const build = JSON.parse(readFileSync(path.join(dist, 'build-manifest.json'), 'utf8'));
const sizeCache = new Map();
const chunk = (file) => {
  if (!sizeCache.has(file)) {
    const buf = readFileSync(path.join(dist, file));
    const src = buf.toString('utf8');
    sizeCache.set(file, { gz: gzipSync(buf).length, heavy: Object.keys(HEAVY).filter((k) => HEAVY[k].test(src)) });
  }
  return sizeCache.get(file);
};

const rows = [];
for (const [route, segment] of Object.entries(ROUTES)) {
  const file = path.join(dist, 'server/app', `${segment}_client-reference-manifest.js`);
  if (!existsSync(file)) {
    rows.push({ route, error: 'no manifest' });
    continue;
  }
  const holder = {};
  globalThis.__RSC_MANIFEST = holder;
  new Function(readFileSync(file, 'utf8'))();
  const manifest = Object.values(holder)[0];
  const files = new Set(build.rootMainFiles);
  const parts = segment.split('/');
  for (const [entry, list] of Object.entries(manifest.entryJSFiles)) {
    const name = entry.replace('[project]/app/', '');
    // the page itself and every layout on its path (not sibling error/not-found boundaries'
    // own extra chunks: those load on demand)
    const isOwn =
      name === segment || parts.some((_, i) => name === [...parts.slice(0, i), 'layout'].join('/')) || name === 'layout';
    if (isOwn) for (const f of list) files.add(f);
  }
  let gz = 0;
  const heavy = new Set();
  for (const f of files) {
    const c = chunk(f);
    gz += c.gz;
    c.heavy.forEach((h) => heavy.add(h));
  }
  rows.push({ route, chunks: files.size, firstLoadKb: Math.round(gz / 1024), heavy: [...heavy] });
}

if (args.includes('--json')) console.log(JSON.stringify(rows, null, 2));
else for (const r of rows) console.log(r.error ? `${r.route} | ${r.error}` : `${r.route} | ${r.firstLoadKb} KB gz | ${r.chunks} chunks | ${r.heavy.join(', ') || '—'}`);
