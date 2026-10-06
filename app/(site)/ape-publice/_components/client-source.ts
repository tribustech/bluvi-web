import { createHttpPublicWatersSource, type PublicWatersSource } from '@/core/lakes';

/** The base of the dataset routes (app/(site)/ape-publice/api/[...slug]/route.ts). */
const BASE = '/ape-publice/api/';

let source: PublicWatersSource | null = null;

/** The browser's public-waters source: the web's own JSON routes, every answer validated by core. */
export function browserPublicWaters(): PublicWatersSource {
  source ??= createHttpPublicWatersSource(async (path, query) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) params.set(k, String(v));
    const qs = params.toString();
    const res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ''}`, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`ape-publice ${path}: HTTP ${res.status}`);
    return res.json();
  });
  return source;
}
