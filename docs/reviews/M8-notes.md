# M8 — review notes

## m8.cache-warming — «Unexpected cache miss after cache warming phase» (M8-B1)

**Before:** 3 warnings in the Vercel production build (dpl_8eaUXAn2uiyx8jNBcjB8yQGrFjHZ, «ignore-listed frames»); 5 in a local `next build` (3 of the same kind + 2 from the sitemap).
**After:** 0 in a local `next build` (`NEXT_PRIVATE_DEBUG_CACHE=1` shows which key missed).

**Cause.** None of our cache keys came from a clock or carried unstable objects. The misses came from short-lived entries. An entry whose `expire` is under 5 minutes (`cacheLife('seconds')`) is dropped from a prerender. When the warming pass reads such an entry from the shared in-memory cache handler, because another page filled it first, Next does not copy it into the page's resume cache. The final pass then misses that key and warns. The page ends up the same either way, a dynamic hole, so the warning was noise and not a broken page.

- **Vercel's 3** were `waterModel('_', null)` in lib/server/og/images.ts: the OG alt of the `/ape-publice/_/…` placeholder pages that `generateStaticParams` creates. A water the bundled dataset does not have was drawn as the brand card and kept for **seconds**. It is now kept `max`, as long as the dataset (readWater already keeps it that long). Only a slow read is still retried soon.
- **The 2 local sitemap misses** (`/feed/competitions/<id>` → 404 in `cachedPublicGet`) were competitions the parallel M5/M6 e2e deleted while the build ran: listed, then gone. That is data changing mid-build, not our code. Error answers keep their seconds life on purpose (a CMS 404/5xx is never baked into a static page).
- Hardening, same CMS requests: `cachedPublicGet` keys on a canonical `[url, headers with sorted keys]` (publicGetArgs). The URL is never reordered, because its query order is the request Cloudflare caches. The OG models and images key on `[id as a string, label or null]` (ogModelArgs), never `$undefined`. Next calls an image's metadata without params while it collects routes, and the water card used to look up a water called «undefined».
- Test: tests/unit/use-cache-args.test.ts (same input → identical JSON).

### Follow-up (review of M8-B1): the class, not one entry

The first fix moved one key (`waterModel('_')`) and one build's timing gave 0. The cause is a class: **any `'use cache'` entry under 5 minutes of expire that several prerendered pages share**. A slower CMS, or an empty CMS list that makes `_` the param, brings it back. The old build log already showed it: 9 `omitting entry … short expire value: 60` (2 × `sessions/_`, 7 × `competitionModel([realId, null])` that hit the 4 s OG read budget under build load).

- **Placeholder ids never reach the CMS** (lib/server/public-get.ts `placeholderAnswer`): a GET whose path has the segment `_` is answered with the CMS's 404 before any cache entry or request. This covers `/concursuri/_/…`, `/balti/_/…`, `/stiri/_`, `/sponsori/_`, `/partide/_`, `/partide/_/galerie`, `/pescari/_`. Real ids are untouched, and their 404s are still never baked.
- **The OG alt of a placeholder id has no cache entry at all** (`ogAlt`). Since the placeholder page now 404s at once, the warming pass could end before the metadata asked, and the final pass then missed `lakeModel('_', 'Partide' | 'Recenzii')` / `waterModel('_', 'Capturi')` (seen in 2 of 2 empty-CMS builds before this change).
- **No OG model is kept under `minutes`** (`unreadLife`; `Life` no longer has `'seconds'`): a placeholder or non-id → `max`; a water the dataset does not have → `max`; a CMS 404 / unreadable shape → `minutes` (its tag refreshes it); a slow or transient failure → `minutes`.
- **Build read budget:** during `next build` (`NEXT_PHASE=phase-production-build`) an OG read waits 20 s (a visitor's request keeps 4 s / 2.5 s), and a transient failure is tried once more, so completed competitions keep their podium card in the static shell.
- **priceFrom `ratesFrom`** (app/(site)/balti/[id]/_components/priceFrom.ts): a failed quote lives `minutes` while the build prerenders, still `seconds` at runtime. The key is shared by the lake page and its OG card. With a slow CMS it was the last 5 `omitting entry` lines.
- **Sitemap history walk** (lib/server/sitemap-entries.ts `watersWithPartide`): it reads page 1, then the rest 6 at a time. Read one after another (96 pages locally), a slow CMS took `/sitemaps/sitemap/ape-publice-0.xml` past the 60 s page timeout and **failed the build**.

**Verified:** 4 production builds through a proxy in front of the local CMS (each answer delayed 200–1500 ms), `NEXT_PRIVATE_DEBUG_CACHE=1`:

| build | CMS | `Unexpected cache miss` | `omitting entry` | placeholder URLs sent to the CMS |
|---|---|---|---|---|
| slow ×2 (before / after the priceFrom change) | full data | 0 / 0 | 5 (ratesFrom) / **0** | 0 |
| empty ×2 | lakes index, news, sponsors, completed competitions empty → every `_` route | **0 / 0** | 0 | 0 |

Before the follow-up, the same proxy gave 4 warnings plus the sitemap build failure (slow, 300–3000 ms), and 2–3 warnings (empty). Check after a build: `grep -c 'omitting entry' log` should be 0, in particular for the competitionModel keys with real documentIds.

**Residual, accepted:** a real id whose CMS read fails during the build (a 5xx or timeout on `/feed/competitions/<id>`, or a competition deleted mid-build) still produces a `seconds`-lived `cachedPublicGet` entry. That is on purpose: a CMS error is never baked into a static page. If siblings share it, the warning can come back. Each such warning names a real CMS failure during the build.

Tests: tests/unit/use-cache-args.test.ts runs the real models with `next/cache` and the loaders mocked. A placeholder gets no cache entry for the alt and `max` for the image. An absent water gets `max`. A missing CMS entity and a transient failure get `minutes`. The build retries. A placeholder GET makes no request. lib/server/sitemap-entries.test.ts covers the parallel walk.


## m8.a11y-audit — every route, axe WCAG 2.0/2.1 A + AA, 375 and 1280 (M8-B3)

**Result (2026-10-09, local CMS, shared dev server):** `tests/e2e/a11y-audit.spec.ts` — 209 tests, all green. 96 `page.tsx` patterns → 101 rows (a competition per status, `/` and `/partide` signed out and in, `/pescari/[id]` both ways) × 2 widths = 202 route scans, plus the consent banner + preferences dialog (2) and 4 keyboard tests. **0 axe violations.** No row skipped: every fixture id resolved through core/ (competition started / notStarted / completed, a stand with weighings, a free Chita slot, an own not-started competition, Chita, Snagov, news, sponsor, partidă, angler, an angler booking and an operator booking).

- **Route table:** `tests/e2e/helpers/a11y-routes.ts`. One test fails when a `page.tsx` has no row, so a new page joins the audit or breaks it.
- **Auth:** guest for public pages. The QA user for per-user pages, and also for organizer pages (it holds the Organizer role) and operator pages (it owns Chita). Each per-user scan asserts it was not bounced to `/intra`.
- **States scanned:** filters (`/balti`, `/concursuri`), species (1280) / search (375) on `/balti`, followers (a Sheet under 1280, the docked side panel from 1280), share / directions on the lake page, photo viewer (lake hero at 1280, `/galerie` at both widths), contact (an alertdialog popover at 1280), search palette, consent preferences (from Acasă and `/setari`).
- **Read-only:** every non-GET through `/api/cms` is answered locally and Firestore is aborted.

**Fixed by root cause.** axe reported 0 violations. These are its «needs review» items and pixel-probe failures:

| rule | where | fix |
|---|---|---|
| aria-prohibited-attr (aria-label on a generic span) | ranking `PlaceCell` «–» (fără loc) / «=» (egal), components/ranking/shell.tsx: every ranking table; 6 nodes on the live competition at each width | the glyph `aria-hidden`, the words `sr-only` |
| aria-prohibited-attr | partidă catches table «–» (necântărită), CatchesView.tsx | same |
| aria-prohibited-attr | competition page «Vezi mai mult» text overlay (Sheet / reading Dialog): its focusable scroll body carried aria-label without a role, tabParts.tsx | `role="region"` |
| color-contrast (over image) | `/intra` < 768: «MAI APROAPE DE CE IUBEȘTI» over the photo's dawn band, 2.1:1 | a scrim behind the intro, fading in above the eyebrow (≥ 4.5:1) |
| color-contrast (over decorative art) | `/partide` LUNA invitation at ≥ 1280: «Recordul lunii te așteaptă» over the corner trophy, 4.35:1 | the headline in `on-bento-indigo` (white, 4.9:1) |

**Pixel probe.** axe cannot rate text over an image, gradient, pseudo-element or overlap (1 225 «incomplete» nodes). For each of them the probe freezes transitions, hides the node's text, screenshots its glyph box and rates the text colour against those pixels at the 5th percentile. Of 1 179 nodes probed, the ones still flagged after the two fixes above are:
- nodes under a fixed bar at screenshot time (the `/balti` list under the phone's bottom bar, the allocation status above its gradient fade);
- initials covered by the avatar photo;
- decorative dots or icons inside the box (the live hero's status dot, store logos, the tab count badge);
- the `aria-hidden` «·» separator on the review page.

None of them is a readable text pair under AA.

**Keyboard** (same spec):
- Tab order: the skip link «Sari la conținut» comes first and is visible when focused; the next Tab stop is the top bar; activating the skip link moves focus into `main`.
- Dialog: Filtre on `/balti` keeps 40 Tabs and a Shift+Tab inside, Escape closes it, and focus returns to the opener.
- Owner rule 8: a programmatically focused `h1` has no ring.

**Excluded, with the reason at the call site:** `.maplibregl-map` (the maplibre-gl canvas and its controls, third party) on `/balti/harta`, `/balti/[id]/harta`, `/ape-publice`, `/ape-publice/[id]`, `/ape-publice/[id]/harta`. CMS-authored rich text (news, rules) is scanned and passes.

**Sector colours (ROADMAP §8 kit gap):** they stay fish's A–X values. They draw only the stripe and the dot. Text on a sector fill takes `components/ranking/sector.ts` `sectorInk` (white or black, every pair ≥ 4.6:1), so B, C and K pass without changing fish's palette (rules 12/15).


## m8.perf-audit — production build + Lighthouse on the top public pages (M8-B4)

**How it was measured.** `NEXT_DIST_DIR=.next-m8-perf npx next build`, `next start -p 3200` against the local CMS, `lhci collect` with lighthouserc.json (mobile, simulated throttling: 150 ms RTT, 1.6 Mbps, CPU ×4; 412 × 823 @1.75; 3 runs), medians per metric with `node scripts/lighthouse-summary.mjs`. URLs: `node scripts/lighthouse-urls.mjs --write` (ids through core/: Chita, the first completed competition, the newest article, a community partidă with catches and photos). First-load JS per route: `node scripts/lighthouse-bundles.mjs .next-m8-perf` (root main files + the page's and its layouts' entry chunks, gzip; it also flags maplibre-gl / supercluster / tiptap / firebase / gifenc in a first load). The machine was shared (load average 50–110 through the runs): the same page varied by up to 1.5 s of LCP between runs, so read differences under ~0.5 s as noise.

**Route table.** Every audited page is `◐` (partial prerender: static shell + per-user holes). Prerendered ids: 129 lakes, 20 completed competitions, 150 public waters; news, partide and the lists render their ids on demand into the same shell.

| page | LCP ms before → after | CLS | TBT ms | JS KB (transfer) | first-load JS gz |
|---|---|---|---|---|---|
| `/` | 4650 → 4143 | 0.047 → 0 | 63 → 32 | 507 → 506 | 389 → 388 |
| `/balti` | 3742 → 4049 | **0.065 → 0.007** | 83 → 66 | 603 → 623 | 361 → 361 |
| `/balti/[id]` (Chita) | 4907 → 4752 | 0.002 | 49 → 54 | 601 → 581 | 364 → 348 |
| `/balti/harta` | 8074 → 10049 | 0.001 → 0.002 | 2187 → 394 | 873 → 883 | 351 → 351 |
| `/concursuri` | 5474 → 4655 | 0 | 98 → 70 | 507 → 506 | 398 → 398 |
| `/concursuri/[id]` | 5301 → 3132 | 0.006 | 49 → 54 | 671 → 660 | 497 → 481 |
| `/concursuri/[id]/clasament` | 5285 → **2723** | 0.006 | 46 → 67 | 671 → 660 | 497 → 481 |
| `/ape-publice` | 12354 → 12390 | 0.003 | 324 → 383 | 882 → 897 | 357 → 357 |
| `/stiri` | 4416 → **2281** | 0 | 57 → 37 | 505 → 486 | 302 → 301 |
| `/stiri/[id]` | 4814 → 3090 | 0 | 53 → 58 | 505 → 486 | 337 → 321 |
| `/partide` | 5556 → 3189 | 0 | 51 → 47 | 655 → 661 | — → 335 |
| `/partide/[id]` | 4373 → 3378 | 0 | 31 → 36 | 573 → 578 | 367 → 351 |

Budgets (LCP < 2500, CLS < 0.05, TBT < 200): CLS is green everywhere, TBT everywhere but the two map pages, LCP only on `/stiri` (and `/concursuri/[id]/clasament` in 2 of its 3 runs). None of maplibre-gl, supercluster, tiptap, firebase or gifenc is in a non-map page's first load any more.

**Fixed, by root cause:**
1. **The main content painted 300 ms after the shell, behind the JavaScript.** React 19.2's streaming runtime throttles Suspense reveals: a boundary that completes after the shell painted waits until 300 ms after the previous reveal. React outlines every boundary past its 12.8 KB progressive chunk (`flushedByteSize + boundary.byteSize > progressiveChunkSize`), and the head + top bar already use that up, so even the prerendered content of a lake, a competition, an article or the Partide hub arrived as a hidden segment + `$RC` and was revealed ≥ 300 ms after the first paint. By then the bundle had loaded and run, and Lighthouse's simulation charged all of it to the LCP. `lib/reveal-now.ts` (first script in `<head>`) keeps React's `$RT` timestamp unset, so `$RC` takes its own `requestAnimationFrame` branch: the observed LCP is now the first paint on every non-map page (it was FCP + 300–1200 ms). It only changes when React reveals; if React renames the variable it does nothing. e2e `p1`.
2. **/balti CLS 0.065:** the location placeholder card is 218 px tall below 768, its skeleton reserved 176 (`min-h-44`). Both now take `min-h-55` (220). e2e `p3`.
3. **The italic Nunito face was preloaded on every page** (31 KB at high priority, before the LCP) and almost never drawn. It moved from next/font to an `@font-face` of the same family in app/globals.css: loaded on first use. e2e `p2`.
4. **supercluster + the T2Map module on pages without a map** (lake page, competition, article, partidă: −16 KB gz first load): `Lightbox` and `ReputationBlock` took `T2Spinner` from the T2 barrel, `MiniMap` took the style URL from `T2Map`. They import `T2MapOverlay` / `maplibre.ts` (which now holds `T2_MAP_STYLE`) directly.
5. **LCP images that were lazy:** the phone's first full rail on /balti (first two cards), the first two cards of the /balti/harta list (eager + high, a client list), the guest's Live preview poster on /concursuri. The grid card's `priority` became `fetchPriority="high"` while staying lazy, and no image preload: the page holds the phone rails and the desktop grid at once, one of them `display:none`, and a preload or an eager image downloads even when hidden (a phone was fetching the desktop grid's first row, which pushed /balti's simulated LCP up by ~1 s in the intermediate build).

**Left, with numbers and a proposal:**
- **LCP 3.1–4.8 s on the non-map pages** is now bytes before the first paint, not a late paint. On localhost every async chunk has finished downloading before the first paint (localhost round trips take under a millisecond), so Lantern counts all of it in the LCP graph. Per page: the document 50–70 KB, the CSS 47 KB (one global sheet, 320 KB raw: Tailwind utilities actually used in app/ and components/; scoping the sources changes 3 KB), the font 67 KB, the JS ~300 KB (react-dom 72, router 39, zod + core schemas 31, TanStack + consent + GA gate 18, shell 9–15 each). Proposal, in order of yield: (a) run the same lhci against the Vercel preview, where the chunks arrive after the first paint as on a real phone, and keep localhost as the regression check; (b) take zod out of the static shell (the top bar imports `core/social` only for the signed-in unread count: lazy-import it once the viewer is known) and lazy-load the command palette, the mobile menu and the consent preferences dialog on first open; (c) subset the upright font further (Latin, Latin-1, Extended-A/B, punctuation, currency: ~45 KB estimated from 67); (d) audit the utility CSS for one-off arbitrary variants.
- **Map pages** (`/balti/harta` 10.0 s, `/ape-publice` 12.4 s; TBT 390 ms): the list and the LCP wait for maplibre-gl (149 KB gz main thread + 144 KB gz worker) and for the map's first bounds; `/ape-publice`'s list title «Cele mai mari ape din zonă» arrives at ~4.2 s observed. Proposal: serve the first list page for the initial viewport (Romania or the URL's bbox) from the server before the map loads, and start maplibre-gl after the first paint (idle), so the map is no longer on the LCP path. Not done here: it changes when the list's bounds come from the map, which is behaviour the M1 parity criteria pin.
- **`Unexpected cache miss after cache warming phase`** (m8.cache-warming, M8-B1) came back in these builds: 1, 0, 26, 32 and 6 warnings across five builds of the same code. `NEXT_PRIVATE_DEBUG_CACHE=1` names the keys: `/feed/community/lakes/<id>`, `/feed/lakes/<id>` and the `community venue` model, all with `short stale value: 60` («delaying entry … until after the shell stage»). This is the shared-short-entry class from the B1 note (stale 60 s, not only expire under 5 min), timing-dependent under machine load. Not changed here (B1's area); it needs the stale floor of `cachedPublicGet` during the build looked at.
- Observed, not caused here: a dev-only `$RS` «Cannot read properties of null (reading 'parentNode')» page error on `/` signed in at 1280 (1 in 8 loads with React's own throttle, 1 in 8 with reveal-now; 0 in 16 on the production build), which fails `acasa.spec.ts` «1280px · signed in» intermittently. The `pescar.visual` «sesiuni» / «concursuri 375» baselines differ by the live partidă's relative time line («Început acum …»), not by these changes; the baselines were not updated.
