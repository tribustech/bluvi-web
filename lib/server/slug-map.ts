import { slugMap, type SlugMap } from '@/lib/slug-route';

/*
 * A CMS URL map (`GET /feed/lakes/slugs`, `GET /feed/competitions/slugs`: edge-cached and purged on
 * any write of the entity) for proxy.ts, kept in memory per server instance for five minutes. A
 * failed or missing read (a CMS without the route yet) gives an empty map — every URL then works as
 * before — and is retried after a minute, not on every request.
 */

const FRESH_MS = 5 * 60_000;
const RETRY_MS = 60_000;
const TIMEOUT_MS = 2_000;

type Entry = { documentId: string; slug: string };

function entries(rows: unknown): Entry[] {
  if (!Array.isArray(rows)) return [];
  return (rows as { documentId?: unknown; slug?: unknown }[]).filter(
    (e): e is Entry => typeof e.documentId === 'string' && typeof e.slug === 'string' && e.slug.length > 0
  );
}

/** A reader of the map at `path` (`data`: current slugs, `aliases`: earlier ones, optional). */
export function cmsSlugMap(path: string): () => Promise<SlugMap> {
  let cached: { map: SlugMap; until: number } | null = null;
  let inflight: Promise<SlugMap> | null = null;

  async function read(): Promise<SlugMap> {
    const base = (process.env.CMS_URL ?? process.env.NEXT_PUBLIC_CMS_URL ?? '').replace(/\/$/, '');
    if (!base) return slugMap([]);
    try {
      const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { data?: unknown; aliases?: unknown };
      cached = { map: slugMap(entries(body.data), entries(body.aliases)), until: Date.now() + FRESH_MS };
    } catch {
      cached = { map: cached?.map ?? slugMap([]), until: Date.now() + RETRY_MS };
    }
    return cached.map;
  }

  return async () => {
    if (cached && cached.until > Date.now()) return cached.map;
    inflight ??= read().finally(() => {
      inflight = null;
    });
    return inflight;
  };
}
