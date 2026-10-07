import { timingSafeEqual } from 'node:crypto';
import { MAX_TAG_LENGTH } from '@/core/cache/headers';

export const MAX_TAGS_PER_CALL = 100;

export function secretMatches(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Validates the CMS webhook body `{ tags: string[] }`; returns the tags or an error message. */
export function parseRevalidateBody(body: unknown): { tags: string[] } | { error: string } {
  const tags = (body as { tags?: unknown } | null)?.tags;
  if (!Array.isArray(tags) || tags.length === 0) return { error: 'tags must be a non-empty array' };
  if (tags.length > MAX_TAGS_PER_CALL) return { error: `at most ${MAX_TAGS_PER_CALL} tags per call` };
  const clean = tags.filter((t): t is string => typeof t === 'string' && t.length > 0 && t.length <= MAX_TAG_LENGTH);
  if (clean.length !== tags.length) return { error: 'every tag must be a non-empty string ≤ 256 chars' };
  return { tags: [...new Set(clean)] };
}

/**
 * How long Next may keep serving a page built from `tag` once the CMS purges it. Default `max`
 * (stale-while-revalidate: the next visit still gets the old page while it regenerates). A
 * partidă's own tag `session-<id>` is purged when it goes PRIVATE (visibleOnProfile false, CMS
 * purgeTagsNow — domain invariants 14/15): a stale copy would show a private partidă (its page,
 * JSON-LD, share card) to the next visitor, so it expires at once and the next visit blocks on a
 * fresh read (next docs revalidateTag `{ expire: 0 }`, the webhook case).
 */
export function revalidateProfileFor(tag: string): 'max' | { expire: number } {
  return tag.startsWith('session-') ? { expire: 0 } : 'max';
}
