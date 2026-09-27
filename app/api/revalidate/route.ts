import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { parseRevalidateBody, secretMatches } from '@/lib/server/revalidate';

/**
 * CMS webhook: every batch of cache tags the CMS purges on Cloudflare is POSTed here too
 * (CMS patch P1), so static pages built from those responses refresh within seconds.
 * `max` = serve stale while the next visit regenerates (Next's recommended profile).
 */
export async function POST(req: NextRequest) {
  if (!secretMatches(req.headers.get('x-revalidate-secret'), process.env.REVALIDATE_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const parsed = parseRevalidateBody(await req.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  for (const tag of parsed.tags) revalidateTag(tag, 'max');
  return NextResponse.json({ revalidated: parsed.tags.length });
}
