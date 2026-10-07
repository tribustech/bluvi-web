import { MY_BUCKETS, myDefaultSub, mySubsFor, type MyBucket, type MySub } from '@/core/booking';

/*
 * Rezervările mele's place in the URL (booking.rezervarile-mele c2–c5): `?tab=` the bucket and
 * `?filtru=` its sub-filter, in Romanian slugs. The landing tab («Toate») and a bucket's default sub
 * («Viitoare» on «Confirmate», the unfiltered view elsewhere) are left out, so the list at rest has a
 * clean URL. An unknown or foreign value falls back to the default — a stale link never breaks the page.
 */
export const TAB_PARAM = 'tab';
export const SUB_PARAM = 'filtru';

export const TAB_SLUG: Record<MyBucket, string> = {
  all: 'toate',
  pending: 'in-asteptare',
  confirmed: 'confirmate',
  unfinished: 'nefinalizate',
};

export const SUB_SLUG: Record<MySub, string> = {
  today: 'azi',
  upcoming: 'viitoare',
  past: 'trecute',
  rejected: 'respinse',
  cancelled: 'anulate',
  noshow: 'neprezentari',
};

const bySlug = <K extends string>(map: Record<K, string>, slug: string | null | undefined): K | undefined =>
  (Object.keys(map) as K[]).find((k) => map[k] === slug);

/** The bucket the URL names («Toate» when none / unknown). */
export function parseTab(slug: string | null | undefined): MyBucket {
  const b = bySlug(TAB_SLUG, slug);
  return b && MY_BUCKETS.includes(b) ? b : 'all';
}

/**
 * The sub the URL names for `bucket`, or `null` when the URL says nothing usable (the caller then
 * uses the remembered / default sub). `undefined` is never returned: the unfiltered view is the
 * absence of `filtru`.
 */
export function parseSub(bucket: MyBucket, slug: string | null | undefined): MySub | null {
  const s = bySlug(SUB_SLUG, slug);
  return s && mySubsFor(bucket).includes(s) ? s : null;
}

/** The query values for (bucket, sub): defaults are null (removed from the URL). */
export function urlValues(bucket: MyBucket, sub: MySub | undefined): { tab: string | null; filtru: string | null } {
  return {
    tab: bucket === 'all' ? null : TAB_SLUG[bucket],
    filtru: sub && sub !== myDefaultSub(bucket) ? SUB_SLUG[sub] : null,
  };
}

/** `?tab=…&filtru=…` for a link / the sign-in return path ('' at rest). */
export function myBookingsQuery(tab?: string | null, filtru?: string | null): string {
  const bucket = parseTab(tab);
  const sub = parseSub(bucket, filtru);
  const v = urlValues(bucket, sub ?? myDefaultSub(bucket));
  const q = new URLSearchParams();
  if (v.tab) q.set(TAB_PARAM, v.tab);
  if (v.filtru) q.set(SUB_PARAM, v.filtru);
  const s = q.toString();
  return s ? `?${s}` : '';
}
