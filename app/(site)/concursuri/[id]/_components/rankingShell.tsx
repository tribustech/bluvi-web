'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowsPointingOutIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { sectorFill } from '@/components/ranking/sector';
import { IconButton } from '@/components/nav/IconButton';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

/*
 * The table shell shared by the rankings the kit RankingTable does not draw (FeederRanking.tsx,
 * NcRanking.tsx), and the ranking card's toolbar band every ranking of the page uses (RankingView.tsx
 * too): one card, one band of controls at its top, one frame, one set of header / cell / pin steps,
 * one place cell. Same tokens as the kit table (components/ranking/RankingTable.tsx: page-grey 40px
 * header, 52px rows, t-table, hairlines, the place as a plain t-num-18 number). TODO(kit): export
 * these from components/ranking and use them in RankingTable too — this task may only touch the
 * competition page.
 *
 * Layers (the region is its own stacking context, `isolate`): the header row sticks at the top
 * (z-above), the pinned header corner over it (z-sticky); pinned body cells are `sticky` with no
 * z-index — positioned, so they paint over the cells that scroll under them, and under the header.
 */

/** The ranking card's band of controls (RankingView's toolbar): one row, on the card's surface. */
export const RANKING_TOOLBAR = 'flex min-w-0 items-center gap-3 px-3 py-2.5';

/**
 * A ranking card: the band of controls at its top, then the table (a RankingFrame `embedded`). What is
 * not a table (a state, the leg's sector cards from 1280) goes under the card, `after`.
 */
export function RankingCard({ toolbar, children, after }: { toolbar: ReactNode; children?: ReactNode; after?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-clip rounded-card bg-surface shadow-e0">
        <div className={RANKING_TOOLBAR}>{toolbar}</div>
        {children}
      </div>
      {after}
    </div>
  );
}

/**
 * «Clasament complet» in the band (RankingView's pattern): the labelled button from 1280, the
 * full-screen icon 768–1279; none on the phone (the action bar has it).
 */
export function FullViewButtons({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
  return (
    <>
      <Button variant="secondary" icon={<ArrowsPointingOutIcon />} onClick={onPress} disabled={disabled} className="shrink-0 max-xl:hidden">
        Clasament complet
      </Button>
      <IconButton
        aria-label="Clasament complet"
        title="Clasament complet"
        onClick={onPress}
        disabled={disabled}
        size="size-11"
        className="shrink-0 max-md:hidden xl:hidden"
      >
        <ArrowsPointingOutIcon aria-hidden />
      </IconButton>
    </>
  );
}

/** A header cell without its side padding (a table that sets its own, e.g. a leg's tight numbers). */
export const RANK_TH_BASE = 'sticky top-0 z-above bg-page t-label whitespace-nowrap text-ink-2';
/** A header cell on the card's own surface (a leg's sector card from 1280, under the card's title). */
export const RANK_TH_SURFACE_BASE = 'sticky top-0 z-above bg-surface t-label whitespace-nowrap text-ink-2';
/** A header cell: the kit's page-grey band, sticky at the top of the region. */
export const RANK_TH = `${RANK_TH_BASE} px-2`;
/** The second row of a grouped header (under a 32px first row). */
export const RANK_TH_ROW2 = 'top-8';
/** A pinned header cell (the corner): over the header cells that scroll under it. */
export const RANK_TH_PIN = 'z-sticky';
/** A body cell without its side padding. */
export const RANK_TD_BASE = 'h-13 border-t border-hairline';
/** A body cell: the kit's 52px row, hairline on top. */
export const RANK_TD = `${RANK_TD_BASE} px-2`;
/** A pinned body cell (with its own surface, so the scrolled cells pass under it). */
export const RANK_PIN = 'sticky';
/** The last pinned cell: a soft shadow at its right edge once the table is scrolled sideways. */
export const RANK_PIN_EDGE =
  "after:pointer-events-none after:absolute after:inset-y-0 after:left-full after:w-2 after:bg-linear-to-r after:from-ink/8 after:to-transparent after:opacity-0 after:transition-opacity after:duration-(--duration-fast) after:content-[''] group-data-[scrolled=true]/rank:after:opacity-100";

/** The surface a pinned cell paints: the row's own (the viewer's row keeps its tint). */
export const pinSurface = (me: boolean) => (me ? 'bg-accent-tint' : 'bg-surface');

/**
 * The scrolling region. Wider than its card it scrolls sideways: `data-scrolled` once moved off the
 * start (the pinned block's edge shadow), and the right edge fades while there is more to see.
 */
export function RankingFrame({
  caption,
  full = false,
  region = true,
  embedded = false,
  className,
  children,
}: {
  caption: string;
  /**
   * Inside a card (RankingCard, a leg's sector card): no radius or shadow of its own, a hairline
   * under what is above it; the focus ring is drawn inside (the card clips).
   */
  embedded?: boolean;
  /** false: a card inside a region that already names the table (the leg's sector cards from 1280). */
  region?: boolean;
  /** In «Tot ecranul»: the table scrolls inside the dialog (the header row sticks there). */
  full?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const start = el.scrollLeft > 1;
      const more = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      el.dataset.scrolled = String(start);
      el.dataset.more = String(more);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const table = el.querySelector('table');
    if (table) ro.observe(table);
    el.addEventListener('scroll', update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', update);
    };
  }, []);
  return (
    <div
      ref={ref}
      role={region ? 'region' : undefined}
      aria-label={region ? caption : undefined}
      tabIndex={region ? 0 : undefined}
      className={cn(
        // Tailwind 4: `outline-none` is outline-style none, which `outline-2` does not undo —
        // `outline-solid` brings the ring back (WCAG 2.4.7).
        'group/rank isolate overflow-auto bg-surface outline-none [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent',
        embedded ? 'border-t border-hairline focus-visible:-outline-offset-2' : 'rounded-card shadow-e0',
        'data-[more=true]:[mask-image:linear-gradient(to_left,transparent,black_--spacing(6))]',
        full && 'max-h-full',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The table inside the frame. */
export function RankingGrid({ caption, className, children }: { caption: string; className?: string; children: ReactNode }) {
  return (
    <table className={cn('w-full border-separate border-spacing-0 t-table whitespace-nowrap tabular-nums', className)}>
      <caption className="sr-only">{caption}</caption>
      {children}
    </table>
  );
}

/**
 * A place: the kit RankingTable's idiom at every width — a plain t-num-18 number (the viewer's row in
 * accent ink), a half place «1,5» (averaged ties) or none «–» the same way. A winner / the podium adds
 * the trophy (the leg's sector winner wears the same one), never a fill.
 */
export function PlaceCell({ value, winner = false, onTint = false }: { value: number | string; winner?: boolean; onTint?: boolean }) {
  const raw = typeof value === 'string' ? value : String(value);
  const text = raw === '-' ? '–' : raw.replace('.', ',');
  return (
    <span className={cn('inline-flex items-center gap-1 t-num-18', onTint && 'text-accent-ink')}>
      {text === '–' ? (
        <span aria-label="fără loc">–</span>
      ) : (
        <>
          <span className="sr-only">Locul </span>
          {text}
        </>
      )}
      {winner ? (
        <>
          <TrophyIcon aria-hidden className="size-4 shrink-0 text-accent-ink" />
          <span className="sr-only">, podium</span>
        </>
      ) : null}
    </span>
  );
}

/** «C13» → { sector: «C», stand: «13» }; «A3(12)» → «A», «3(12)». No letter: no sector. */
export function splitSeat(seat: string): { sector: string; stand: string } {
  const m = /^([A-Za-z])(.+)$/.exec(seat.trim());
  return m ? { sector: m[1].toUpperCase(), stand: m[2] } : { sector: '', stand: seat };
}

/**
 * A stand label with its sector cue: the sector's dot, then «C13»; read as «Sector C, stand 13»
 * (the kit RankingTable's stand cell). «–» (not seated) stays a dash.
 */
export function SeatLabel({ seat }: { seat: string }) {
  const { sector, stand } = splitSeat(seat);
  if (!sector) return <>{seat === '-' ? '–' : seat}</>;
  const fill = sectorFill(sector, 'var(--color-muted)');
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', fill.className)} style={fill.style} />
      <span className="sr-only">
        Sector {sector}, stand {stand}
      </span>
      <span aria-hidden>{seat}</span>
    </span>
  );
}
