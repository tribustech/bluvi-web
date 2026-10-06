/*
 * fish `features/lakes/helpers/recentViewedLakes.ts` — the pure half. The lake page pushes the id
 * when it opens; the Bălți home reads the list (newest LAST, shown newest first). Storage is the
 * UI's (fish AsyncStorage, the web per-browser storage): core only owns the key, the parse and
 * the update so both sides agree (parity lakes.detail.c3, lakes.b.recently-viewed).
 *
 * The list logic (MAX_RECENT_VIEWED_LAKE_IDS, parseRecentViewedLakeIds, pushRecentViewedLakeId)
 * already lives in ./search — it exists once; this file only adds the storage key.
 */

/** fish ASYNC_STORAGE_KEYS.RECENT_VIEWED_LAKE_IDS. */
export const RECENT_VIEWED_LAKE_IDS_KEY = 'recentViewedLakeIds';
