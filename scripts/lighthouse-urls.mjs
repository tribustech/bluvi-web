#!/usr/bin/env node
/**
 * The Lighthouse URL list (M8-B4, global.b.performance-audit): the top public pages with ids that
 * exist in the CMS the build reads, resolved through core/ — the same reads the app makes — like
 * tests/e2e/helpers/a11y-routes.ts discoverIds. lighthouserc.json keeps the last resolved list as
 * local fixtures; this script prints a fresh one (or rewrites lighthouserc.json with --write) when
 * the local DB has moved on.
 *
 *   node scripts/lighthouse-urls.mjs [--base http://localhost:3200] [--write]
 *
 * Ids: the lake is Chita (the QA user's lake, the richest public lake page: photos, booking,
 * reviews); the competition is the first completed one (its page and ranking have data); the news
 * article is the newest; the partidă is a community partidă with ≥ 2 catches and photos.
 * Env overrides: CMS_URL, E2E_LAKE_CHITA.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { alias: { '@': root } });

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const base = (flag('--base') ?? 'http://localhost:3200').replace(/\/$/, '');

const { createTestTransport } = await jiti.import('@/tests/transport');
const { getCompetitionsByStatus } = await jiti.import('@/core/competitions/api');
const { getNews } = await jiti.import('@/core/news/api');
const { getCommunityHistory } = await jiti.import('@/core/partide/api');

const t = createTestTransport();
const first = (p) => p.catch(() => null);

const completed = (await first(getCompetitionsByStatus(t, 'completed', { page: 1, pageSize: 5 })))?.data[0]?.documentId ?? null;
const news = (await first(getNews(t, { page: 1, pageSize: 1 })))?.data[0]?.documentId ?? null;
let partida = null;
for (let page = 1; page <= 4 && !partida; page++) {
  const h = await first(getCommunityHistory(t, { page, pageSize: 25 }));
  partida = h?.data.find((s) => s.documentId && s.catchCount >= 2 && (s.photoCount ?? s.photos?.length ?? 0) > 0)?.documentId ?? null;
  if (!h || page >= h.meta.pagination.pageCount) break;
}
const lake = process.env.E2E_LAKE_CHITA ?? 's84u55lo4n9z0emngozttt6e';

const paths = [
  '/',
  '/balti',
  `/balti/${lake}`,
  '/balti/harta',
  '/concursuri',
  completed && `/concursuri/${completed}`,
  completed && `/concursuri/${completed}/clasament`,
  '/ape-publice',
  '/stiri',
  news && `/stiri/${news}`,
  '/partide',
  partida && `/partide/${partida}`,
];
const missing = { completed, news, partida };
for (const [k, v] of Object.entries(missing)) if (!v) console.error(`lighthouse-urls: no ${k} id in this CMS — its page is left out`);
const urls = paths.filter(Boolean).map((p) => `${base}${p}`);

if (args.includes('--write')) {
  // Only the url list is rewritten; the rest of the file keeps its hand formatting.
  const file = path.join(root, 'lighthouserc.json');
  const src = readFileSync(file, 'utf8');
  const list = urls.map((u) => `        ${JSON.stringify(u)}`).join(',\n');
  const next = src.replace(/"url": \[[^\]]*\]/, `"url": [\n${list}\n      ]`);
  JSON.parse(next); // still valid
  writeFileSync(file, next);
  console.error(`lighthouse-urls: wrote ${urls.length} URLs to lighthouserc.json`);
}
console.log(urls.join('\n'));
