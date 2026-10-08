'use client';

import { cn } from '@/components/ui/cn';
import { useLivePartide } from '../../../../_live';
import { CARD } from './parts';

/*
 * «Sincronizare» (fish InfoScene; c7): the live partidă syncs through the realtime projection, so
 * the row is the connectivity flag — «Sincronizat» (green) online, «Offline» (amber) offline. The
 * flag is the browser's (fish NetInfo `isOnline`): the server render and the first client render
 * answer online.
 */
export function SyncRow() {
  const { online } = useLivePartide();
  return (
    <div data-testid="setari-sync" className={cn(CARD, 'flex min-h-12 items-center justify-between gap-4 px-4 py-3')}>
      <span className="t-body text-muted">Sincronizare</span>
      <span
        role="status"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 t-label',
          online ? 'bg-status-success-bg text-status-success-fg' : 'bg-status-warning-bg text-status-warning-fg',
        )}
      >
        <span aria-hidden className={cn('size-1.5 rounded-full', online ? 'bg-success' : 'bg-yellow-6')} />
        {online ? 'Sincronizat' : 'Offline'}
      </span>
    </div>
  );
}
