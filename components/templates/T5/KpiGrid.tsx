import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { SignatureNumber } from '@/components/ui/SignatureNumber';
import { cn } from '@/components/ui/cn';

export interface KpiGridProps {
  /** Group name for assistive tech («Azi, pe scurt»). */
  label: string;
  /**
   * pair: always two side by side (the fish panel's tile pair; a 320px side column).
   * quad: two on a phone; from 768 one row of the tiles given (three or four), on ~152px minimum
   *   tracks, at every width — 768's 704, 1280's 680 centre and 1440's 752 all hold four. More
   *   room makes the row longer, never a 2×2 block of empty tiles.
   * auto: two on a phone, then as many ~200px columns as fit — more tiles, never wider ones.
   */
  columns?: 'pair' | 'quad' | 'auto';
  /**
   * The figures of this row take the 26px step instead of the 40px one — decided once for the
   * whole row (every non-live tile, so the figures read at one size and on one baseline). Set it
   * when a long value (`isLongValue`, «12.400») shares a row of four: a ~150px tile has no room
   * for it at 40. The live figure stays the signature 64.
   */
  compact?: boolean;
  children: ReactNode;
  className?: string;
}

/** A value longer than this («12.400», «1.250,5») does not fit a four-up tile at the 40px step. */
const LONG_VALUE = 5;

export function isLongValue(value: ReactNode): boolean {
  return (typeof value === 'string' || typeof value === 'number') && String(value).length > LONG_VALUE;
}

/**
 * The KPI tile row. Children: <KpiTile>. Every tile spans three rows of this grid (label · number
 * · caption) through subgrid, so the tiles of a row share the three tracks: a caption that wraps,
 * or a tile without one, never moves a number off the line its neighbours sit on — and the
 * numbers sit on one baseline whatever their size.
 */
export function KpiGrid({ label, columns = 'auto', compact = false, children, className }: KpiGridProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        // The number track is at least 68px, so a tile keeps the bento's 156 minimum (Fundații §07).
        'grid auto-rows-[auto_minmax(--spacing(17),auto)_auto] grid-cols-2 gap-3',
        columns === 'auto' && 'md:grid-cols-[repeat(auto-fill,minmax(--spacing(50),1fr))] xl:gap-4',
        columns === 'quad' && 'md:grid-cols-[repeat(auto-fit,minmax(--spacing(38),1fr))] xl:gap-4',
        className,
      )}
    >
      {/* The row's step goes to every tile (a server component: a prop, not a context). */}
      {compact
        ? Children.map(children, (child) =>
            isValidElement(child) && child.type === KpiTile ? cloneElement(child as ReactElement<KpiTileProps>, { compact: true }) : child,
          )
        : children}
    </div>
  );
}

export interface KpiTileProps {
  /** What the number counts, over it, sentence case («De încasat azi»). One line. */
  label: string;
  value: ReactNode;
  /** Set after the number, muted («/21», « lei»). */
  unit?: ReactNode;
  /**
   * One more line at the bottom: a trend or context («azi inclus», «15 libere»). Keep it short;
   * it wraps to two lines at most. The slot is kept when empty, so the tile keeps its rows.
   */
  detail?: ReactNode;
  detailTone?: 'muted' | 'success' | 'danger';
  /**
   * The one «happening now» figure of the view (occupancy now): navy, the lavender signature
   * number (the kit's CountTile look). One per page (Fundații §07).
   */
  live?: boolean;
  /** Set by KpiGrid `compact` (the row's step); not for direct use. */
  compact?: boolean;
  className?: string;
}

const DETAIL: Record<NonNullable<KpiTileProps['detailTone']>, string> = {
  muted: 'text-muted',
  success: 'text-status-success-fg',
  danger: 'text-status-danger-fg',
};

/** The number row: on the shared baseline of the grid's middle track, never wrapped. */
const NUMBER_ROW = 'self-baseline whitespace-nowrap';

/**
 * A dashboard figure: the kit's bento tile (Fundații §07 — radius 20, inset 18, label on top, the
 * signature number in the middle, the detail at the bottom), on the surface, so the panel's
 * figures are the same objects as Acasă's and the kit's. The number is the kit's SignatureNumber
 * (`tile` 64 for the live figure, `stat` 40 for the rest). `live` is the navy tile (CountTile). No
 * label icon: the label carries the meaning (fish), and an outline icon would have to shrink below
 * 24 (§05). The tile has no landmark of its own; the grid names the group.
 *
 * TODO(kit) (this task may only touch T5): a SignatureNumber `compact` size (t-num-26 / t-unit-18)
 * for the row's `compact` step, drawn here until then; CountTile's label class exported from
 * BentoTile (copied below); a `subgrid` path on BentoTile so this stays a thin wrapper (its flex
 * column can't take subgrid rows, and cn() does not merge conflicting utilities); and one kit
 * decision on whether a StatTile on the page ground carries e0 (this one does, like every T5 card).
 */
export function KpiTile({ label, value, unit, detail, detailTone = 'muted', live = false, compact = false, className }: KpiTileProps) {
  return (
    <div className={cn('row-span-3 grid min-w-0 grid-rows-subgrid gap-2 rounded-bento p-4.5', live ? 'bg-navy' : 'bg-surface shadow-e0', className)}>
      {/* The navy tile's label in the caps eyebrow step (CountTile's look, on the type scale). */}
      <p className={cn('truncate', live ? 't-eyebrow text-lavender-2 uppercase' : 't-label text-muted')}>{label}</p>
      {live ? (
        <SignatureNumber size="tile" tone="lavender" unitTone="lavender" value={value} unit={unit} className={NUMBER_ROW} />
      ) : compact ? (
        <p className={cn(NUMBER_ROW, 't-num-26 text-ink')}>
          {value}
          {unit ? <span className="t-unit-18 tracking-normal text-muted">{unit}</span> : null}
        </p>
      ) : (
        <SignatureNumber size="stat" value={value} unit={unit} className={NUMBER_ROW} />
      )}
      <p aria-hidden={detail ? undefined : true} className={cn('line-clamp-2 t-caption text-pretty', live ? 'text-lavender-3' : DETAIL[detailTone])}>
        {detail || ' '}
      </p>
    </div>
  );
}
