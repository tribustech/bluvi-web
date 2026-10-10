import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CMS } from './session';

/*
 * Direct SQL on the LOCAL CMS Postgres, for the one write the API cannot undo (owner 2026-10-10):
 * angler reviews have no delete endpoint, so the real-review e2e removes the review it created here.
 * The connection is read from ../fir-intins-cms/.env (DATABASE_* keys only); the password goes to psql
 * through the environment, never on the command line or in a log. Refuses anything that is not the
 * local CMS on a loopback database.
 */

const CMS_ENV = join(process.cwd(), '..', 'fir-intins-cms', '.env');
const KEYS = ['DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_NAME', 'DATABASE_USERNAME', 'DATABASE_PASSWORD'] as const;

function dbEnv(): Record<(typeof KEYS)[number], string> {
  const out = {} as Record<(typeof KEYS)[number], string>;
  for (const line of readFileSync(CMS_ENV, 'utf8').split('\n')) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m && (KEYS as readonly string[]).includes(m[1])) out[m[1] as (typeof KEYS)[number]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

/** True only for the local CMS on a loopback Postgres — the only place these helpers may write. */
export function localDbAvailable(): boolean {
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(CMS)) return false;
  try {
    const env = dbEnv();
    return ['127.0.0.1', 'localhost', '::1'].includes(env.DATABASE_HOST) && !!env.DATABASE_NAME;
  } catch {
    return false;
  }
}

/** Runs `sql` (a script, read from stdin) with ON_ERROR_STOP; returns psql's unaligned output. */
export function localSql(sql: string): string {
  if (!localDbAvailable()) throw new Error('local-db: not the local CMS / loopback database — refusing');
  const env = dbEnv();
  return execFileSync(
    'psql',
    ['-h', env.DATABASE_HOST, '-p', env.DATABASE_PORT || '5432', '-U', env.DATABASE_USERNAME, '-d', env.DATABASE_NAME, '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-At'],
    { input: sql, env: { ...process.env, PGPASSWORD: env.DATABASE_PASSWORD }, encoding: 'utf8' }
  ).trim();
}

/** A Strapi documentId (cuid2, lower-case alphanumerics) — the only thing these helpers interpolate. */
function docId(id: string): string {
  if (!/^[a-z0-9]{20,32}$/.test(id)) throw new Error(`local-db: not a documentId: ${id}`);
  return id;
}

/**
 * Moves a booking THE TEST CREATED to the first free 12h window of 2019 on its stand, so the CMS treats
 * the stay as ended (a walk-in cannot be created in the past: WINDOW_ENDED). One transaction; exactly
 * one row or nothing.
 */
export function backdateTestBooking(bookingId: string): string {
  const id = docId(bookingId);
  return localSql(`
BEGIN;
DO $$
DECLARE s timestamp; n int;
BEGIN
  SELECT gs INTO s FROM generate_series('2019-01-02 06:00'::timestamp, '2019-12-30 06:00'::timestamp, interval '1 day') gs
  WHERE NOT EXISTS (
    SELECT 1 FROM bookings o
    WHERE o.occupies AND o.document_id <> '${id}'
      AND o.stand_key = (SELECT stand_key FROM bookings WHERE document_id = '${id}')
      AND tsrange(o.start_date, o.end_date) && tsrange(gs, gs + interval '12 hours'))
  ORDER BY gs LIMIT 1;
  IF s IS NULL THEN RAISE EXCEPTION 'local-db: no free 2019 window on the stand'; END IF;
  UPDATE bookings SET start_date = s, end_date = s + interval '12 hours' WHERE document_id = '${id}';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'local-db: expected to move exactly one booking row, got %', n; END IF;
END $$;
SELECT end_date FROM bookings WHERE document_id = '${id}';
COMMIT;`);
}

/**
 * Deletes the angler review(s) linked to a booking THE TEST CREATED — its four link rows, then the
 * review row — in one transaction, only when exactly `expected` such reviews exist. Returns how many
 * were removed. Nothing else is recomputed: the reputation is aggregated on read.
 */
export function deleteReviewsOfTestBooking(bookingId: string, expected: number): number {
  const id = docId(bookingId);
  const out = localSql(`
BEGIN;
CREATE TEMP TABLE e2e_rv ON COMMIT DROP AS
  SELECT DISTINCT l.angler_review_id AS id FROM angler_reviews_booking_lnk l
  JOIN bookings b ON b.id = l.booking_id WHERE b.document_id = '${id}';
DO $$ BEGIN IF (SELECT count(*) FROM e2e_rv) <> ${expected} THEN RAISE EXCEPTION 'local-db: expected ${expected} review(s) for the booking'; END IF; END $$;
DELETE FROM angler_reviews_angler_lnk WHERE angler_review_id IN (SELECT id FROM e2e_rv);
DELETE FROM angler_reviews_author_lnk WHERE angler_review_id IN (SELECT id FROM e2e_rv);
DELETE FROM angler_reviews_booking_lnk WHERE angler_review_id IN (SELECT id FROM e2e_rv);
DELETE FROM angler_reviews_lake_lnk WHERE angler_review_id IN (SELECT id FROM e2e_rv);
WITH d AS (DELETE FROM angler_reviews WHERE id IN (SELECT id FROM e2e_rv) RETURNING id) SELECT count(*) FROM d;
COMMIT;`);
  return Number(out.split('\n').pop());
}

/** How many angler reviews are linked to a booking (a read). */
export function reviewsOfBooking(bookingId: string): number {
  const id = docId(bookingId);
  return Number(localSql(`SELECT count(*) FROM angler_reviews_booking_lnk l JOIN bookings b ON b.id = l.booking_id WHERE b.document_id = '${id}';`));
}
