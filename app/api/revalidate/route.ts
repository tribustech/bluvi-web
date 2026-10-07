import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { parseRevalidateBody, revalidateProfileFor, secretMatches } from '@/lib/server/revalidate';

/**
 * CMS webhook: every batch of cache tags the CMS purges on Cloudflare is POSTed here too
 * (CMS patch P1), so static pages built from those responses refresh within seconds.
 * `max` = serve stale while the next visit regenerates (Next's recommended profile), except the
 * privacy-relevant tags (a partidă's `session-<id>`), which expire at once (revalidateProfileFor).
 */
export async function POST(req: NextRequest) {
  if (!secretMatches(req.headers.get('x-revalidate-secret'), process.env.REVALIDATE_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const parsed = parseRevalidateBody(await req.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  for (const tag of parsed.tags) revalidateTag(tag, revalidateProfileFor(tag));
  return NextResponse.json({ revalidated: parsed.tags.length });
}
