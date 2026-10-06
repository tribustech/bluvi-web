'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { TrophyIcon } from '@heroicons/react/16/solid';
import { cn } from '@/components/ui/cn';
import { sectorFill } from './sector';
import { RANKING_HEAD } from './tableHead';

/*
 * The ranking table's shared parts — one source for every ranking table on the site: the kit
 * RankingTable (the competition's standard / Best-N table), the feeder legs and the National
 * Championship club tables (the competition page's FeederRanking / NcRanking).
 *
 *  - one header row: the coloured 40px band RANKING_HEAD (ROADMAP §4b.12), sticky;
 *  - one body row: 52px, t-table, a hairline on top;
 *  - one place idiom (PlaceCell): a plain t-num-18 number, «=» before a tied one, and a solid 16px
 *    trophy for the marks a place can carry — never a fill, never a pill in a table:
 *      podium  (places 1–3 with a catch)        accent-ink trophy, «, podium»
 *      prize   (bestOf's / a club's winners)    accent-ink trophy, «, câștigător»
 *      sector  (a sector winner)                muted trophy,      «, câștigător de sector»
 *    The 16px solid glyph reads as a cup at 16px (the 24px outline one read as an hourglass);
 *  - the sector: its 4px edge (or the dot in a row-group header), never a fill under text;
 *  - the penalty: fish's one marker beside the name.
 *
 * Layers (the frame is its own stacking context, `isolate`): the header row sticks at the top
 * (z-above), the pinned header corner over it (z-sticky); pinned body cells are `sticky` with no
 * z-index — positioned, so they paint over the cells that scroll under them, and under the header.
 */

/** The header band without wrapping or padding: a table whose titles wrap (fish's two-line heads). */
export const RANK_TH_HEAD = `sticky top-0 z-above ${RANKING_HEAD} t-label`;
/** A header cell without its side padding (a table that sets its own, e.g. a leg's tight numbers). */
export const RANK_TH_BASE = `${RANK_TH_HEAD} whitespace-nowrap`;
/** A leg's sector card from 1280 (under the card's title): the same coloured header row. */
export const RANK_TH_SURFACE_BASE = RANK_TH_BASE;
/** A header cell: the coloured header band, sticky at the top of the region. */
export const RANK_TH = `${RANK_TH_BASE} px-2`;
/** The second row of a grouped header (under a 32px first row). */
export const RANK_TH_ROW2 = 'top-8';
/** A pinned header cell (the corner): over the header cells that scroll under it. */
export const RANK_TH_PIN = 'z-sticky';
/** A body cell without its side padding. */
export const RANK_TD_BASE = 'h-13 border-t border-hairline';
/** A body cell: the 52px row, hairline on top. */
export const RANK_TD = `${RANK_TD_BASE} px-2`;
/** A pinned body cell (with its own surface, so the scrolled cells pass under it). */
export const RANK_PIN = 'sticky';
/** The last pinned cell: a soft shadow at its right edge once the table is scrolled sideways. */
export const RANK_PIN_EDGE =
  "after:pointer-events-none after:absolute after:inset-y-0 after:left-full after:w-2 after:bg-linear-to-r after:from-ink/8 after:to-transparent after:opacity-0 after:transition-opacity after:duration-(--duration-fast) after:content-[''] group-data-[scrolled=true]/rank:after:opacity-100";

/**
 * The pinned name column's header from 1280: a bounded 320px track, so the number columns share the
 * rest instead of a wide gap before them — the standard table's `--name-col` cap (tableFixes
 * GENERAL_TABLE_LAYOUT), for the tables built on this shell. A plain length on purpose: Chrome treats
 * a table cell's `width` holding min()/max() with a percentage as `auto`, so `min(320px, 30%)` would
 * cap nothing.
 */
export const RANK_NAME_CAP = 'xl:w-80';

/** The surface a pinned cell paints: the row's own (the viewer's row keeps its tint). */
export const pinSurface = (me: boolean) => (me ? 'bg-accent-tint' : 'bg-surface');

/**
 * The ranking region's height when it scrolls on its own (wider than its card, or any table on the
 * phone): the viewport minus the page's sticky chrome (phone: the 56px bar + the competition's
 * pinned rows; from 768: the 64px bar + the 44px route tabs) and some air — so its sticky header row
 * (top-0 inside the region) takes effect, instead of scrolling off with the page (ROADMAP §4b.12).
 * The class for a RankingFrame / a wrapper; RANK_SCROLL_CAP_PHONE is the phone value as a length
 * (the kit RankingTable's `maxHeight`).
 */
export const RANK_SCROLL_CAP = 'max-h-[calc(100dvh-var(--spacing)*40)] md:max-h-[calc(100dvh-var(--spacing)*32)]';
export const RANK_SCROLL_CAP_PHONE = 'calc(100dvh - var(--spacing) * 40)';

/**
 * Fits its card from 768: no scroll box at all (clipped sideways, visible down), so the header row
 * follows the page under the 64px top bar and the competition's 44px route tabs (top-27, 108px —
 * tableFixes STICKY_HEAD_PAGE, the standard table's), a grouped header's second row 32px under it.
 * The phone keeps the capped region (the bar there slides away; a page-sticky header would float).
 */
const FITS_ON_PAGE = [
  'md:data-[fits=true]:max-h-none md:data-[fits=true]:overflow-x-clip md:data-[fits=true]:overflow-y-visible',
  'md:data-[fits=true]:[&_thead_tr:first-child>th]:top-27 md:data-[fits=true]:[&_thead_tr:nth-child(2)>th]:top-35',
].join(' ');

/**
 * The scrolling region. Wider than its card it scrolls sideways: `data-scrolled` once moved off the
 * start (the pinned block's edge shadow), and the right edge fades while there is more to see.
 * Down, the header row always stays in view (ROADMAP §4b.12): a table that fits (from 768) lets the
 * page scroll it and its header sticks under the page's chrome (`data-fits`, FITS_ON_PAGE); a wider
 * one (and every table on the phone) scrolls inside a viewport-high region (RANK_SCROLL_CAP), where
 * the header sticks at its top. «Tot ecranul» (`full`): the dialog's height.
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
   * Inside a card (a ranking card, a leg's sector card): no radius or shadow of its own, a hairline
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
      // Against the box's outer width: a capped region's own vertical scrollbar never makes a table
      // that fits read as wide (no flip-flop between the two layouts).
      el.dataset.fits = String(el.scrollWidth <= el.offsetWidth + 1);
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
        full ? 'max-h-full' : cn(RANK_SCROLL_CAP, FITS_ON_PAGE),
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

/** What a place (or a name) is marked with. See the header. */
export type PlaceMark = 'podium' | 'prize' | 'sector';

const MARK_TONE: Record<PlaceMark | 'inherit', string> = {
  podium: 'text-accent-ink',
  prize: 'text-accent-ink',
  sector: 'text-muted',
  // On a filled cell (a winner row, a tint): the cell's own ink.
  inherit: '',
};

const MARK_SR: Record<PlaceMark, string> = {
  podium: ', podium',
  prize: ', câștigător',
  sector: ', câștigător de sector',
};

/** The mark's glyph: the 16px solid trophy, with what it means for a screen reader. */
export function WinnerTrophy({
  mark,
  srText,
  inherit = false,
  className,
}: {
  mark: PlaceMark;
  /** Overrides the default «, podium» … */
  srText?: string;
  /** On a filled cell: the glyph takes the cell's ink instead of its mark's tone. */
  inherit?: boolean;
  className?: string;
}) {
  return (
    <>
      <TrophyIcon aria-hidden data-mark={mark} className={cn('size-4 shrink-0', MARK_TONE[inherit ? 'inherit' : mark], className)} />
      <span className="sr-only">{srText ?? MARK_SR[mark]}</span>
    </>
  );
}

/**
 * A place — the one idiom of every ranking table: a plain t-num-18 number (the viewer's row in
 * accent ink), «=» before a tied one, a half place «1,5» (averaged ties) or none «–» the same way;
 * a mark adds the trophy. `align="end"` (a right-aligned column) puts the trophy before the number,
 * so the digits stay aligned down the column.
 */
export function PlaceCell({
  value,
  tied = false,
  mark,
  onTint = false,
  onFill = false,
  align = 'start',
}: {
  value: number | string;
  tied?: boolean;
  mark?: PlaceMark | null;
  onTint?: boolean;
  /** On a filled cell (fish's sector fills): the number and the trophy take the cell's ink. */
  onFill?: boolean;
  align?: 'start' | 'end';
}) {
  const raw = typeof value === 'string' ? value : String(value);
  const text = raw === '-' ? '–' : raw.replace('.', ',');
  const trophy = mark ? <WinnerTrophy mark={mark} inherit={onFill} /> : null;
  return (
    <span className={cn('inline-flex items-center gap-1 align-middle t-num-18', onTint && !onFill && 'text-accent-ink')}>
      {align === 'end' ? trophy : null}
      {text === '–' ? (
        <span aria-label="fără loc">–</span>
      ) : (
        <span>
          <span className="sr-only">Locul </span>
          {tied ? <span aria-label="egal">=</span> : null}
          {text}
        </span>
      )}
      {align === 'start' ? trophy : null}
    </span>
  );
}

/** «C13» → { sector: «C», stand: «13» }; «A3(12)» → «A», «3(12)». No letter: no sector. */
export function splitSeat(seat: string): { sector: string; stand: string } {
  const m = /^([A-Za-z])(.+)$/.exec(seat.trim());
  return m ? { sector: m[1].toUpperCase(), stand: m[2] } : { sector: '', stand: seat };
}

/**
 * A stand label with its sector cue: the sector's dot, then «C13»; read as «Sector C, stand 13».
 * «–» (not seated) stays a dash.
 */
export function SeatLabel({ seat, dot = true }: { seat: string; /** false: the cell draws the sector's 4px edge instead. */ dot?: boolean }) {
  const { sector, stand } = splitSeat(seat);
  if (!sector) return <>{seat === '-' ? '–' : seat}</>;
  const fill = sectorFill(sector, 'var(--color-muted)');
  return (
    <span className="inline-flex items-center gap-1.5">
      {dot ? <span aria-hidden className={cn('size-2 shrink-0 rounded-full', fill.className)} style={fill.style} /> : null}
      <span className="sr-only">
        Sector {sector}, stand {stand}
      </span>
      <span aria-hidden>{seat}</span>
    </span>
  );
}

/** fish PenaltyCard: a 10×14 mark beside the name, red when eliminated, yellow otherwise. */
export function PenaltyMarker({ eliminated, label, reasons }: { eliminated: boolean; label: string; reasons?: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={reasons ? `${label}: ${reasons}` : label}
      className={cn('inline-block h-3.5 w-2.5 shrink-0 rounded-[2px]', eliminated ? 'bg-status-danger-fg' : 'bg-badge-yellow-fg')}
    />
  );
}

/**
 * A weight cell's text where a scored entry caught nothing: «–», «Fără capturi» for a screen reader
 * (ROADMAP §4b.11, as the standard and NC tables). `kg` is the model's string («0.000», «-», …).
 */
export function KgText({ kg }: { kg: string }) {
  const n = Number(kg);
  if (kg !== '-' && kg.trim() !== '' && Number.isFinite(n) && n === 0) {
    return (
      <>
        <span aria-hidden>–</span>
        <span className="sr-only">Fără capturi</span>
      </>
    );
  }
  return <>{kg === '-' ? '–' : kg.replace('.', ',')}</>;
}
