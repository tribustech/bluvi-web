import 'server-only';
import { ApiError } from '@/core/transport';

/*
 * Development-only fault switch for the ranking image's e2e tests (tests/e2e/
 * concurs-imagine-clasament.spec.ts): the page's reads are server-side, so page.route cannot fail
 * or hold them. A test POSTs to /concursuri/<id>/clasament/imagine/e2e-fault (./e2e-fault/route.ts)
 * and the next renders of THAT competition's image page see the faults:
 *  - `<read>` fails the read like a network error; `<read>-slow` holds it SLOW_MS first.
 *    Reads: `competition` (the page's competition read: error.tsx / loading.tsx), `ranking` (the
 *    plan's ranking read: the stage's own skeleton while it streams).
 * In production builds the switch is a no-op (NODE_ENV is inlined) and the route answers 404.
 */

type Store = Map<string, Set<string>>;
const g = globalThis as typeof globalThis & { __bluviRankingImageE2eFaults?: Store };

export const e2eFaultsEnabled = () => process.env.NODE_ENV !== 'production';

export function e2eFaultStore(): Store {
  g.__bluviRankingImageE2eFaults ??= new Map();
  return g.__bluviRankingImageE2eFaults;
}

const SLOW_MS = 4000;

/** Resolves when the read may run; rejects (as a network failure) or waits when a fault says so. */
export async function e2eFault(id: string, read: 'competition' | 'ranking'): Promise<void> {
  const faults = e2eFaultsEnabled() ? g.__bluviRankingImageE2eFaults?.get(id) : undefined;
  if (!faults) return;
  if (faults.has(`${read}-slow`)) await new Promise(r => setTimeout(r, SLOW_MS));
  if (faults.has(read)) throw new ApiError({ message: `e2e fault: ${read}`, status: 0, code: 'NETWORK', path: read });
}
