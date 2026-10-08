'use client';

import { useEffect, useRef, type ComponentType, type RefObject, type SVGProps } from 'react';
import { ChartBarIcon, ClockIcon, TrophyIcon, UsersIcon } from '@heroicons/react/24/outline';
import { BENTO_INK, BentoArt, bentoSurface } from '@/components/ui/BentoTile';
import { SignatureNumber } from '@/components/ui/SignatureNumber';
import { cn } from '@/components/ui/cn';
import type { OrganizerStatKey } from '@/core/organizer';
import type { StatTileModel } from './model';

/** fish STAT_CARDS icons: clock, users, chart-bar, trophy. */
export const STAT_ICON: Record<OrganizerStatKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  pending: ClockIcon,
  empty: UsersIcon,
  fill: ChartBarIcon,
  total: TrophyIcon,
};

/** The dot of a stat's colour (the detail panel's title, the chips): the tile's own surface. */
export const STAT_DOT: Record<StatTileModel['tone'], string> = {
  amber: 'bg-status-warning-fg',
  indigo: 'bg-bento-indigo-2',
  mint: 'bg-status-success-fg',
  signature: 'bg-navy',
};

/** The solid chip / pill of a stat (compact chips, the stat-detail value pill) — AA text on each. */
export const STAT_SOLID: Record<StatTileModel['tone'], string> = {
  amber: 'bg-status-warning-bg text-status-warning-fg',
  indigo: 'bg-bento-indigo text-on-bento-indigo',
  mint: 'bg-status-success-bg text-status-success-fg',
  signature: 'bg-navy text-lavender',
};

const FOCUS = 'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/**
 * c3 / c4 / c6 — the four KPI tiles, Apple-style bento (owner rule 19): each its own surface (the
 * amber tint, the indigo tile, the mint tint, the signature navy), the big figure with its unit
 * apart («87 %», rule 10), the stat's icon large in the corner. Each tile is a button that opens
 * the stat's detail. Two by two on a phone, one row of four from 768.
 */
export function StatTiles({ tiles, onOpen }: { tiles: StatTileModel[]; onOpen: (key: OrganizerStatKey) => void }) {
  return (
    <div role="group" aria-label="Statistici organizator" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:gap-4">
      {tiles.map((t) => (
        <StatTile key={t.key} tile={t} onOpen={onOpen} />
      ))}
    </div>
  );
}

function StatTile({ tile: t, onOpen }: { tile: StatTileModel; onOpen: (key: OrganizerStatKey) => void }) {
  const Icon = STAT_ICON[t.key];
  const ink = BENTO_INK[t.tone];
  const number = useRef<HTMLSpanElement>(null);
  usePulse(number, t.pulse);
  return (
    <button
      type="button"
      onClick={() => onOpen(t.key)}
      data-stat={t.key}
      aria-label={`${t.label}: ${t.value}${t.unit ?? ''}. Vezi detalii`}
      className={cn(
        bentoSurface(t.tone),
        'flex min-h-36 cursor-pointer flex-col justify-between gap-3 rounded-bento p-4.5 text-left md:min-h-39',
        'transition-[filter,translate] duration-(--duration-fast) ease-fast hover:brightness-[.97] active:translate-y-px',
        FOCUS,
      )}
    >
      <BentoArt>
        <Icon />
      </BentoArt>
      <span className={cn('t-label text-balance', ink.fg)}>{t.label}</span>
      <span ref={number} data-pulse={t.pulse || undefined}>
        <SignatureNumber size="stat" value={t.value} unit={t.unit} tone={ink.number} unitTone={ink.unit} className="whitespace-nowrap" />
      </span>
    </button>
  );
}

/**
 * c4 — fish's opacity loop on the pending figure (1 ↔ 0.6, 750 ms each way) while there is
 * something pending; nothing under reduced motion (the figure stays still). Web Animations API:
 * the site's reduced-motion CSS rule cannot reach it, so the check is here.
 */
function usePulse(ref: RefObject<HTMLElement | null>, on: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!on || !el || typeof el.animate !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const run = el.animate([{ opacity: 1 }, { opacity: 0.6 }], { duration: 750, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
    return () => run.cancel();
  }, [ref, on]);
}

/**
 * c7 — the collapsed stats: one row of compact chips («value shortLabel») in the tiles' colours,
 * in the pinned band once the tiles have scrolled away; each opens its detail like the tile (c6).
 */
export function StatChips({ tiles, onOpen, className }: { tiles: StatTileModel[]; onOpen: (key: OrganizerStatKey) => void; className?: string }) {
  return (
    <div role="group" aria-label="Statistici organizator, pe scurt" className={cn('flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}>
      {tiles.map((t) => (
        <button
          key={t.key}
          type="button"
          data-chip={t.key}
          onClick={() => onOpen(t.key)}
          aria-label={`${t.label}: ${t.value}${t.unit ?? ''}. Vezi detalii`}
          className={cn('flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-control px-3.5 whitespace-nowrap hover:brightness-95', STAT_SOLID[t.tone], FOCUS)}
        >
          <span className="t-heading tabular-nums">
            {t.value}
            {t.unit ? <span className="ms-0.5 t-label">{` ${t.unit}`}</span> : null}
          </span>
          <span className="t-label">{t.shortLabel}</span>
        </button>
      ))}
    </div>
  );
}

/** c5 — the tiles' boxes while the stats load (nothing cached): the same grid, the same heights. */
export function StatTilesSkeleton() {
  const tones = ['amber', 'indigo', 'mint', 'signature'] as const;
  return (
    <div aria-hidden data-testid="stats-skeleton" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:gap-4">
      {tones.map((tone) => (
        <div key={tone} className={cn(bentoSurface(tone), 'flex min-h-36 flex-col justify-between gap-3 rounded-bento p-4.5 opacity-60 md:min-h-39')}>
          <span className={cn('block h-3 w-24 rounded-full', tone === 'signature' || tone === 'indigo' ? 'bg-lavender/25' : 'bg-surface/70')} />
          <span className={cn('block h-9 w-16 rounded-full', tone === 'signature' || tone === 'indigo' ? 'bg-lavender/25' : 'bg-surface/70')} />
        </div>
      ))}
    </div>
  );
}
