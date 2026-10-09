# M8 — review notes

## m8.cache-warming — «Unexpected cache miss after cache warming phase» (M8-B1)

**Before:** 3 warnings in the Vercel production build (dpl_8eaUXAn2uiyx8jNBcjB8yQGrFjHZ, «ignore-listed frames»); 5 in a local `next build` (3 of the same kind + 2 from the sitemap).
**After:** 0 in a local `next build` (`NEXT_PRIVATE_DEBUG_CACHE=1` shows which key missed).

**Cause.** None of our cache keys came from a clock or carried unstable objects. The misses came from short-lived entries. An entry whose `expire` is under 5 minutes (`cacheLife('seconds')`) is dropped from a prerender. When the warming pass reads such an entry from the shared in-memory cache handler, because another page filled it first, Next does not copy it into the page's resume cache. The final pass then misses that key and warns. The page ends up the same either way, a dynamic hole, so the warning was noise and not a broken page.

- **Vercel's 3** were `waterModel('_', null)` in lib/server/og/images.ts: the OG alt of the `/ape-publice/_/…` placeholder pages that `generateStaticParams` creates. A water the bundled dataset does not have was drawn as the brand card and kept for **seconds**. It is now kept `max`, as long as the dataset (readWater already keeps it that long). Only a slow read is still retried soon.
- **The 2 local sitemap misses** (`/feed/competitions/<id>` → 404 in `cachedPublicGet`) were competitions the parallel M5/M6 e2e deleted while the build ran: listed, then gone. That is data changing mid-build, not our code. Error answers keep their seconds life on purpose (a CMS 404/5xx is never baked into a static page).
- Hardening, same CMS requests: `cachedPublicGet` keys on a canonical `[url, headers with sorted keys]` (publicGetArgs). The URL is never reordered, because its query order is the request Cloudflare caches. The OG models and images key on `[id as a string, label or null]` (ogModelArgs), never `$undefined`. Next calls an image's metadata without params while it collects routes, and the water card used to look up a water called «undefined».
- Test: tests/unit/use-cache-args.test.ts (same input → identical JSON).
