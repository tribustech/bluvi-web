#!/usr/bin/env node
/**
 * The desktop Lighthouse collect (M8-B4, global.b.performance-audit). lhci runs one settings block
 * per collect, so lighthouserc.json's own `ci.collect` is the mobile run and `ci.desktop` declares
 * this one (lhci itself ignores that key): Lighthouse's `desktop` preset (1350 × 940, no CPU
 * slowdown, 40 ms RTT / 10 Mbps) over the route patterns in `ci.desktop.paths`, whose ids are taken
 * from `ci.collect.url` (so `lighthouse-urls.mjs --write` keeps both in step). The owner's layouts
 * are full-width desktop pages (ROADMAP §4b): the grid's first row, not the phone rail, is the LCP
 * there.
 *
 *   NEXT_DIST_DIR=.next-m8-perf node scripts/lighthouse-desktop.mjs [--runs 3]
 *
 * The lhr files land in .lighthouseci/desktop/; the medians are printed with lighthouse-summary.mjs.
 * Same server as the mobile run: `ci.collect.startServerCommand` (next start -p 3200).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const runsFlag = args.indexOf('--runs');

const rc = JSON.parse(readFileSync(path.join(root, 'lighthouserc.json'), 'utf8')).ci;
const desktop = rc.desktop;
if (!desktop?.paths?.length) throw new Error('lighthouserc.json has no ci.desktop.paths');

/** '/balti/[id]' → a CMS documentId segment (24 chars), so never a static sibling like /balti/harta. */
const pattern = (p) => new RegExp(`^${p.replace(/\[[^\]]+\]/g, '[a-z0-9]{20,}')}$`);
const urls = desktop.paths.map((p) => {
  const url = rc.collect.url.find((u) => pattern(p).test(new URL(u).pathname));
  if (!url) throw new Error(`no ci.collect.url for ${p}`);
  return url;
});

const out = path.join(root, '.lighthouseci');
const dir = path.join(out, 'desktop');
mkdirSync(out, { recursive: true });
const config = path.join(out, 'desktop.lighthouserc.json');
writeFileSync(
  config,
  JSON.stringify(
    {
      ci: {
        collect: {
          ...rc.collect,
          url: urls,
          numberOfRuns: runsFlag >= 0 ? Number(args[runsFlag + 1]) : (desktop.numberOfRuns ?? rc.collect.numberOfRuns),
          settings: desktop.settings,
        },
      },
    },
    null,
    2,
  ),
);

execFileSync('npx', ['lhci', 'collect', `--config=${config}`], { cwd: root, stdio: 'inherit' });

rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
for (const f of readdirSync(out)) if (/^lhr-\d+\.(json|html)$/.test(f)) renameSync(path.join(out, f), path.join(dir, f));
execFileSync('node', [path.join(root, 'scripts/lighthouse-summary.mjs'), dir], { cwd: root, stdio: 'inherit' });
