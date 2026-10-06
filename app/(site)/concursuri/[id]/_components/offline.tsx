import { ErrorState } from '@/components/surfaces/StateCard';
import { QueryRetry } from './QueryRetry';

/*
 * Offline with nothing cached (parity shell states: «offline → error screen»). TanStack pauses a
 * query while the browser is offline (`fetchStatus: 'paused'`) and leaves it `pending`, so a view
 * that only looks at `isPending` would show its skeleton forever. Every view checks this first.
 */

type PausableQuery = { fetchStatus: string; data: unknown };

/** The read is waiting for the network and has nothing to show. */
export function isOfflineEmpty(q: PausableQuery): boolean {
  return q.fetchStatus === 'paused' && q.data === undefined;
}

export const OFFLINE_TITLE = 'Ești offline. Conținutul se va încărca când revine conexiunea.';

/**
 * The views' offline state: the kit ErrorState with the page's retry (QueryRetry: busy while it
 * runs, «Tot nu s-a putut încărca.» when it is still offline).
 */
export function OfflineState({ onRetry, fetching = false, className }: { onRetry: () => void; fetching?: boolean; className?: string }) {
  return <ErrorState className={className} title={OFFLINE_TITLE} action={<QueryRetry fetching={fetching} failed onRetry={onRetry} size="compact" />} />;
}
