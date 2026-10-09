#!/usr/bin/env node
/**
 * Median-run summary of an `lhci collect` (M8-B4, global.b.performance-audit): one row per URL with
 * LCP, CLS, TBT, FCP, the performance score and the JavaScript transferred, against the budgets of
 * lighthouserc.json (ROADMAP §9: LCP < 2.5 s, CLS < 0.05, TBT < 200 ms on mobile). Each metric is
 * its median over the runs, the way lighthouserc's `aggregationMethod: "median-run"` asserts it.
 *
 *   node scripts/lighthouse-summary.mjs [.lighthouseci] [--json]
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--')) ?? '.lighthouseci';
const runs = readdirSync(dir)
  .filter((f) => /^lhr-\d+\.json$/.test(f))
  .map((f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')));

const byUrl = new Map();
for (const lhr of runs) {
  const url = new URL(lhr.requestedUrl).pathname;
  if (!byUrl.has(url)) byUrl.set(url, []);
  byUrl.get(url).push(lhr);
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const audit = (lhr, id) => lhr.audits[id]?.numericValue ?? NaN;
const jsBytes = (lhr) =>
  (lhr.audits['network-requests']?.details?.items ?? [])
    .filter((r) => r.resourceType === 'Script')
    .reduce((n, r) => n + (r.transferSize ?? 0), 0);

const rows = [...byUrl].map(([url, list]) => {
  const pick = (f) => median(list.map(f));
  const row = {
    url,
    runs: list.length,
    score: Math.round(pick((l) => l.categories.performance.score) * 100),
    lcp: Math.round(pick((l) => audit(l, 'largest-contentful-paint'))),
    cls: +pick((l) => audit(l, 'cumulative-layout-shift')).toFixed(3),
    tbt: Math.round(pick((l) => audit(l, 'total-blocking-time'))),
    fcp: Math.round(pick((l) => audit(l, 'first-contentful-paint'))),
    jsKb: Math.round(pick(jsBytes) / 1024),
    lcpElement: list[0].audits['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet?.slice(0, 90) ?? '',
  };
  row.ok = row.lcp < 2500 && row.cls < 0.05 && row.tbt < 200;
  return row;
});

if (args.includes('--json')) console.log(JSON.stringify(rows, null, 2));
else {
  console.log('url | score | LCP ms | CLS | TBT ms | FCP ms | JS KB | budgets');
  for (const r of rows) console.log(`${r.url} | ${r.score} | ${r.lcp} | ${r.cls} | ${r.tbt} | ${r.fcp} | ${r.jsKb} | ${r.ok ? 'green' : 'RED'}`);
}
