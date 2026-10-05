import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { H3_CLASS } from './DetailBody';

/*
 * T3 quick actions — fish VenueQuickActions: square indigo tiles (64px, radius 16, a 24px accent
 * icon, the label under it, a red count/«NOU» pill on the corner) on a fixed rhythm:
 *  - phone, four or more tiles: four 64px tracks spread across the row (`justify-between`), so the
 *    first tile sits on the heading's left edge and the fourth on the card's right edge;
 *  - phone with one to three tiles, and from 768 always: 64px tracks 24px apart, filled from the
 *    left (`auto-fill`) — a fixed rhythm, never three tiles stretched over four tracks.
 * Hover tints the tile. Hidden from 1280 by the page when its side columns (the section index,
 * the booking card) already carry the same jumps.
 *
 * Only actions the web has are tiles: a link (`href`, `external` for another site). The others
 * (no `href`) are named once in a muted line under the row — «În curând pe web: Partide, Hartă.» —
 * the T3 «unavailable» treatment (text-muted + the visible hint), never a row of dead tiles.
 */

export type DetailQuickAction = {
  key: string;
  label: string;
  /** 24px outline Heroicon. */
  icon: ReactNode;
  href?: string;
  /** Opens another site (directions): new tab, with a hint for screen readers. */
  external?: boolean;
  /** Count pill, or a short label like «NOU». */
  badge?: number | string;
};

export function DetailQuickActions({
  actions,
  title = 'Acțiuni rapide',
  unavailableHint = 'În curând pe web',
  className,
}: {
  actions: DetailQuickAction[];
  title?: string;
  unavailableHint?: string;
  className?: string;
}) {
  const available = actions.filter(a => a.href);
  const later = actions.filter(a => !a.href);
  if (!actions.length) return null;
  return (
    <div className={cn('flex flex-col gap-3.5', className)}>
      <h3 className={H3_CLASS}>{title}</h3>
      {available.length ? (
        <ul
          className={cn(
            'grid gap-y-4',
            available.length >= 4
              ? 'grid-cols-[repeat(4,--spacing(16))] justify-between md:grid-cols-[repeat(auto-fill,--spacing(16))] md:justify-start md:gap-x-6'
              : 'grid-cols-[repeat(auto-fill,--spacing(16))] justify-start gap-x-6',
          )}
        >
          {available.map(a => {
            const tile = (
              <>
                <span className="relative flex size-16 items-center justify-center rounded-card bg-accent-tint-2 text-accent-ink transition-[filter] duration-(--duration-fast) ease-fast group-hover:brightness-95 [&>svg]:size-6">
                  {a.icon}
                  {a.badge !== undefined && a.badge !== 0 ? (
                    <span className="absolute -top-1.25 -right-1.25 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-surface bg-status-live-bg px-1.25 t-micro-strong text-status-live-fg">
                      {a.badge}
                    </span>
                  ) : null}
                </span>
                <span className="t-label whitespace-nowrap">{a.label}</span>
              </>
            );
            // Flex centring (not text-align): a label wider than the 64px tile stays centred under it.
            const link = 'group flex w-full cursor-pointer flex-col items-center gap-2 rounded-control text-center transition-opacity duration-(--duration-fast) ease-fast active:opacity-70';
            return (
              <li key={a.key} className="flex justify-center">
                {a.external ? (
                  <a href={a.href} target="_blank" rel="noopener noreferrer" className={link}>
                    {tile}
                    <span className="sr-only">(se deschide într-o filă nouă)</span>
                  </a>
                ) : (
                  <Link href={a.href as string} className={link}>
                    {tile}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {later.length ? (
        <p className="t-caption text-muted">
          {unavailableHint}: {later.map(a => a.label).join(', ')}.
        </p>
      ) : null}
    </div>
  );
}
