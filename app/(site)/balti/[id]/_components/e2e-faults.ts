import 'server-only';
import type { LakeDetail } from '@/core/lakes';
import { ApiError } from '@/core/transport';

/*
 * Development-only fault switch for the lake page's e2e tests (tests/e2e/balta.spec.ts): the page's
 * reads are server-side, so page.route cannot fail or reshape them. A test POSTs to
 * /balti/<id>/e2e-fault (../e2e-fault/route.ts) and the next renders of THAT lake see the faults:
 *  - `<read>` fails the read like a network error (read: lake, community, catches,
 *    competitions-live, competitions-upcoming, reviews; the subpages' first reads `catches-page`,
 *    `stats`, `competitions-tab` — ../_sub/server.ts); `<read>-slow` delays it 2.5s — under the
 *    section timeout (load.ts SECTION_TIMEOUT_MS, 4s), so it is a slow read that SUCCEEDS (the
 *    streaming placeholders, c32); `<read>-hang` delays it 5s — past the timeout, so the read fails
 *    by timing out (the lake read's own bound is 8s: `lake-hang` is just slow); `<read>-404` answers
 *    it as not found (`lake-404`: a lake the public read does not know — unpublished, pending);
 *  - `no-photos`, `no-coordinates`, `owner-without-profile`, `no-optional` (no facilities, fish,
 *    prices, contact, address, website, coordinates), `with-phone` (one contact phone — a
 *    phone-booking lake that lists its number), `deposit` (a 30% deposit lake) reshape the lake (states s4, s9, s8, s12, c16 — the
 *    local CMS has no such lake).
 * In production builds both functions are no-ops (NODE_ENV is inlined) and the route answers 404.
 */

type Store = Map<string, Set<string>>;
const g = globalThis as typeof globalThis & { __bluviLakeE2eFaults?: Store };

export const e2eFaultsEnabled = () => process.env.NODE_ENV !== 'production';

export function e2eFaultStore(): Store {
  g.__bluviLakeE2eFaults ??= new Map();
  return g.__bluviLakeE2eFaults;
}

const faultsFor = (lakeId: string) => (e2eFaultsEnabled() ? g.__bluviLakeE2eFaults?.get(lakeId) : undefined);

const SLOW_MS = 2500;
const HANG_MS = 5000;

/** Resolves when the read may run; rejects (as a network failure) or waits when a fault says so. */
export async function e2eFault(lakeId: string, read: string): Promise<void> {
  const faults = faultsFor(lakeId);
  if (!faults) return;
  if (faults.has(`${read}-slow`)) await new Promise(r => setTimeout(r, SLOW_MS));
  if (faults.has(`${read}-hang`)) await new Promise(r => setTimeout(r, HANG_MS));
  if (faults.has(read)) throw new ApiError({ message: `e2e fault: ${read}`, status: 0, code: 'NETWORK', path: read });
  if (faults.has(`${read}-404`)) throw new ApiError({ message: `e2e fault: ${read}`, status: 404, code: 'HTTP', path: read });
}

export function e2eLakeStub(lakeId: string, lake: LakeDetail): LakeDetail {
  const faults = faultsFor(lakeId);
  if (!faults) return lake;
  return {
    ...lake,
    ...(faults.has('no-photos') ? { images: [] } : {}),
    ...(faults.has('no-coordinates') ? { coordinates: null } : {}),
    ...(faults.has('owner-without-profile') ? { ownerDocumentId: null } : {}),
    ...(faults.has('deposit') ? { paymentMode: 'deposit', depositPercent: 30 } : {}),
    ...(faults.has('with-phone') ? { contact: [{ id: 0, header: null, name: null, phone: '0700 000 000' }] } : {}),
    ...(faults.has('no-optional')
      ? { facility: [], fishSpecies: [], price: [], contact: [], address: null, website: null, coordinates: null }
      : {}),
  };
}
