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

