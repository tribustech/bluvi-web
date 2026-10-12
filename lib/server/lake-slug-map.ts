import { lakeSlugMap, type LakeSlugMap } from '@/lib/lake-slug-route';

/*
 * The CMS's lake URL map (GET /feed/lakes/slugs, edge-cached an hour and purged on any lake write)
 * for proxy.ts, kept in memory per server instance for five minutes. A failed or missing read
 * (a CMS without the route yet) gives an empty map — every /balti URL then works as before — and
 * is retried after a minute, not on every request.
 */

const FRESH_MS = 5 * 60_000;
const RETRY_MS = 60_000;
const TIMEOUT_MS = 2_000;

let cached: { map: LakeSlugMap; until: number } | null = null;
let inflight: Promise<LakeSlugMap> | null = null;

async function read(): Promise<LakeSlugMap> {
  const base = (process.env.CMS_URL ?? process.env.NEXT_PUBLIC_CMS_URL ?? '').replace(/\/$/, '');
  if (!base) return lakeSlugMap([]);
  try {
    const res = await fetch(`${base}/feed/lakes/slugs`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { data?: { documentId?: unknown; slug?: unknown }[] };
    const entries = (body.data ?? []).filter(
      (e): e is { documentId: string; slug: string } => typeof e.documentId === 'string' && typeof e.slug === 'string' && e.slug.length > 0
    );
    cached = { map: lakeSlugMap(entries), until: Date.now() + FRESH_MS };
  } catch {
    cached = { map: cached?.map ?? lakeSlugMap([]), until: Date.now() + RETRY_MS };
  }
  return cached.map;
}

export async function getLakeSlugMap(): Promise<LakeSlugMap> {
  if (cached && cached.until > Date.now()) return cached.map;
  inflight ??= read().finally(() => {
    inflight = null;
  });
  return inflight;
}
