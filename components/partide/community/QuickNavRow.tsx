'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChartBarIcon, TrophyIcon, UsersIcon } from '@heroicons/react/24/outline';
import { ICON_TILE } from '@/components/templates/T5';
import { cn } from '@/components/ui/cn';
import { FOCUS } from './parts';

/*
 * fish features/partide/components/community/QuickNavRow.tsx — three honest destinations
 * (parity partide.comunitate.c6): «Statistici» (amber), «Clasamente» (indigo), «Pescari» (teal).
 * `row`: fish's tiles side by side (phone, tablet); `list`: the desktop left column's rows.
 * A destination that is not on the web yet (href null) is left out — never a dead or inert tile —
 * and with none on the web there is no row at all (owner rule 4).
 */

export type QuickNavTargets = { stats: string | null; ranking: string | null; anglers: string | null };

const TILES: { key: keyof QuickNavTargets; label: string; tone: string; icon: ReactNode }[] = [
  { key: 'stats', label: 'Statistici', tone: 'bg-status-warning-bg text-status-warning-fg', icon: <ChartBarIcon /> },
  { key: 'ranking', label: 'Clasamente', tone: 'bg-accent-tint text-accent-ink', icon: <TrophyIcon /> },
  { key: 'anglers', label: 'Pescari', tone: 'bg-bento-sky text-on-bento-sky', icon: <UsersIcon /> },
];

/** Whether any destination is on the web (the row renders at all). */
export const hasQuickNav = (targets: QuickNavTargets) => TILES.some(t => targets[t.key] != null);

const COLS = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3'] as const;

export function QuickNavRow({ targets, layout = 'row' }: { targets: QuickNavTargets; layout?: 'row' | 'list' }) {
  const tiles = TILES.flatMap(t => {
    const href = targets[t.key];
    return href ? [{ ...t, href }] : [];
  });
  if (tiles.length === 0) return null;
  return (
    <nav aria-label="Scurtături partide" data-testid={`quick-nav-${layout}`}>
      <ul className={cn(layout === 'row' ? cn('grid gap-2.5', COLS[tiles.length]) : 'flex flex-col rounded-card bg-surface p-2 shadow-e0')}>
        {tiles.map(t => (
          <li key={t.key} className="flex">
            <Tile href={t.href} label={t.label} tone={t.tone} icon={t.icon} layout={layout} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Tile({ href, label, tone, icon, layout }: { href: string; label: string; tone: string; icon: ReactNode; layout: 'row' | 'list' }) {
  const row = layout === 'row';
  return (
    <Link
      href={href}
      className={cn(
        row
          ? 'flex w-full flex-col items-center gap-2.25 rounded-card bg-surface px-1.5 py-3.5 shadow-e0'
          : 'flex min-h-11 w-full items-center gap-3 rounded-control px-2.5 py-1.5',
        FOCUS,
        'transition-[background-color,opacity] active:opacity-70',
        row ? 'hover:shadow-[var(--shadow-e2),var(--shadow-e0)]' : 'hover:bg-soft-fill',
      )}
      data-testid={`quick-${label}`}
    >
      <span aria-hidden className={cn(ICON_TILE, 'rounded-full', row && 'size-9.5', tone)}>
        {icon}
      </span>
      <span className={cn('truncate t-label text-ink', !row && 'min-w-0 flex-1')}>{label}</span>
    </Link>
  );
}
