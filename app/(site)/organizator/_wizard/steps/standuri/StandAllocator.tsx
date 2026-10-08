'use client';

import { useId, useMemo, useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { formatCount } from '@/core/realtime/chat/format';
import { sectorVar } from '@/components/ranking/sector';
import { RING_SELECTED } from '@/components/templates/rings';
import { cn } from '@/components/ui/cn';
import { SectorBadge } from '../lac-si-sectoare/SectorBuilder';
import { perfLevels, sectorCount, standLabel, standSector, type AllocatableStand, type Allocations } from './model';
import { PERF_DOT, PERF_TEXT } from './PerformanceExplanation';

type Props = {
  /** Already sorted (sortStands). */
  stands: AllocatableStand[];
  sectorNames: string[];
  allocations: Allocations;
  selectedSector: string | null;
  onSelectSector: (name: string) => void;
  onToggleStand: (standId: string) => void;
  onExplain: () => void;
  disabled?: boolean;
};

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/**
 * The selected tab: white, lifted (e1) AND the 2px accent ring (fish borderWidth 2 $indigo5) — one
 * box-shadow value, since two `shadow-*` utilities on one element cancel each other.
 */
const TAB_ACTIVE = 'bg-surface shadow-[inset_0_0_0_2px_var(--color-accent),var(--shadow-e1)]';

/** More sectors than this (the CMS allows 24, A..X): compact letter chips, the count under it. */
export const COMPACT_SECTORS_AFTER = 8;

/**
 * fish components/StandAllocator.tsx on the web:
 *  - the sector tabs (c3): one tablist, each tab the sector badge, «Sector X» and its count;
 *    ← → / ↑ ↓ / Home / End move between them. Every tab is always visible (no sideways scroller
 *    hiding sectors): a 2-column grid on a phone (the count under the name, as fish), a wrapping
 *    row in a wider card, and from ~670px (1920) a sticky column left of the grid, with the tally.
 *    With more than 8 sectors (up to 24) the tabs become compact letter chips with the count under
 *    the letter (the full «Sector X, N standuri» is the tab's name and tooltip), so 24 sectors stay
 *    a few rows at every width and the sticky column never outgrows the viewport.
 *  - the stand grid (c4–c6, c8): buttons (aria-pressed = in the selected sector), auto-filling
 *    columns; an allocated stand on its sector's tint reads «A12», the selected sector's outlined.
 */
export function StandAllocator({
  stands,
  sectorNames,
  allocations,
  selectedSector,
  onSelectSector,
  onToggleStand,
  onExplain,
  disabled = false,
}: Props) {
  const id = useId();
  const panelId = `${id}-panel`;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const levels = useMemo(() => perfLevels(stands), [stands]);
  const allocatedTotal = stands.filter((s) => standSector(allocations, s.documentId)).length;
  const compact = sectorNames.length > COMPACT_SECTORS_AFTER;

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = sectorNames.length - 1;
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? index === last ? 0 : index + 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? index === 0 ? last : index - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    tabRefs.current[next]?.focus();
    onSelectSector(sectorNames[next]);
  };

  // With no tab selected the first one still takes the Tab key (roving tabindex).
  const focusIndex = Math.max(0, sectorNames.findIndex((n) => n === selectedSector));

  return (
    <div className="@container" data-testid="stand-allocator">
      <div className="grid gap-4 @2xl:grid-cols-[minmax(13rem,15rem)_minmax(0,1fr)] @2xl:items-start @2xl:gap-6">
        <div className="flex min-w-0 flex-col gap-3 @2xl:sticky @2xl:top-24">
          <div
            role="tablist"
            aria-label="Sectoare"
            data-compact={compact || undefined}
            className={cn(
              'grid gap-1 rounded-card bg-soft-fill p-1',
              compact
                ? 'grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))]'
                : 'grid-cols-2 @md:flex @md:flex-wrap @2xl:flex-col',
            )}
          >
            {sectorNames.map((name, i) => {
              const active = name === selectedSector;
              const count = sectorCount(allocations, name);
              const countText = formatCount(count, 'stand', 'standuri');
              return (
                <button
                  key={name}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`${id}-tab-${name}`}
                  aria-selected={active}
                  aria-controls={active ? panelId : undefined}
                  aria-label={compact ? `Sector ${name}, ${countText}` : undefined}
                  title={compact ? `Sector ${name} · ${countText}` : undefined}
                  tabIndex={i === focusIndex ? 0 : -1}
                  onClick={() => onSelectSector(name)}
                  onKeyDown={(e) => onTabKey(e, i)}
                  data-testid={`stand-allocator-sector-${name}`}
                  className={cn(
                    'flex min-w-0 cursor-pointer rounded-control transition-[background-color,box-shadow] duration-(--duration-fast) ease-fast',
                    compact
                      ? 'flex-col items-center gap-1 px-1 py-1.5'
                      : 'items-center gap-2.5 py-2 pr-3 pl-2 text-left @md:shrink-0',
                    FOCUS,
                    active ? TAB_ACTIVE : 'hover:bg-surface/60',
                  )}
                >
                  <SectorBadge name={name} size="sm" />
                  {compact ? (
                    <span className={cn('t-micro-strong tabular-nums', active ? 'text-accent-ink' : 'text-muted')}>{count}</span>
                  ) : (
                    <span className="flex min-w-0 flex-col items-start gap-0.5 @md:flex-row @md:items-center @md:gap-2.5 @2xl:flex-1 @2xl:justify-between">
                      <span className={cn('t-body-strong whitespace-nowrap', active ? 'text-accent-ink' : 'text-ink-2')}>Sector {name}</span>
                      <span
                        className={cn(
                          't-micro-strong whitespace-nowrap rounded-badge @md:px-2 @md:py-0.5',
                          active ? 'text-accent-ink @md:bg-accent-tint' : 'text-muted @md:bg-surface',
                        )}
                      >
                        {countText}
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="t-caption text-muted" data-testid="stand-allocator-tally">
              Alocate: <span className="t-label text-ink">{allocatedTotal}</span> din {stands.length}
            </p>
            <button
              type="button"
              onClick={onExplain}
              className={cn('flex cursor-pointer items-center gap-1 rounded-control t-label text-accent-ink hover:underline', FOCUS)}
            >
              <QuestionMarkCircleIcon aria-hidden className="size-4" />
              Cum funcționează?
            </button>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          {!selectedSector ? (
            <p className="t-caption rounded-control bg-status-warning-bg px-3 py-2 text-center text-status-warning-fg" data-testid="stand-allocator-pick-sector">
              Selectează un sector mai întâi
            </p>
          ) : null}
          <div
            id={panelId}
            role={selectedSector ? 'tabpanel' : undefined}
            aria-labelledby={selectedSector ? `${id}-tab-${selectedSector}` : undefined}
            aria-label={selectedSector ? undefined : 'Standuri'}
            className={cn('grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-2 @2xl:grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))]', !selectedSector && 'opacity-60')}
            data-testid="stand-grid"
          >
            {stands.map((stand) => {
              const sector = standSector(allocations, stand.documentId);
              const level = levels[stand.documentId];
              const inSelected = Boolean(selectedSector) && sector === selectedSector;
              const inert = !selectedSector || disabled;
              return (
                <button
                  key={stand.documentId}
                  type="button"
                  aria-pressed={inSelected}
                  aria-disabled={inert || undefined}
                  aria-label={standLabel(stand.name, sector, level)}
                  onClick={() => {
                    if (inert) return;
                    onToggleStand(stand.documentId);
                  }}
                  data-testid={`stand-allocator-stand-${stand.name}`}
                  data-sector={sector ?? undefined}
                  style={sector ? (sectorVar(sector) as CSSProperties) : undefined}
                  className={cn(
                    'flex min-h-16 flex-col items-center justify-center gap-1 rounded-control px-2 py-2.5 transition-[filter,box-shadow] duration-(--duration-fast) ease-fast',
                    FOCUS,
                    sector ? 'rank-sector-tint text-rank-on-light' : 'bg-soft-fill text-ink',
                    inSelected && RING_SELECTED,
                    inert ? 'cursor-not-allowed' : 'cursor-pointer hover:brightness-95 active:opacity-80',
                  )}
                >
                  <span className="t-body-strong tabular-nums">{sector ? `${sector}${stand.name}` : stand.name}</span>
                  {level ? (
                    <span
                      className={cn('flex items-center gap-1 rounded-badge bg-surface px-1.5 py-px t-micro-strong whitespace-nowrap', PERF_TEXT[level.key])}
                      data-testid="stand-perf"
                    >
                      <span aria-hidden className={cn('size-1.5 rounded-full', PERF_DOT[level.key])} />
                      {level.text}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
