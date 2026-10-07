'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { isMedalPlace, MEDAL } from '@/components/ranking';
import { AsideSection, ChoiceChips, TEXT_ACTION } from '@/components/templates/T1';
import { T2Spinner } from '@/components/templates/T2';
import { cn } from '@/components/ui/cn';
import { fmtKgStat, type StatsPeriod, type StatsTotals } from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';
import { PERIOD_OPTIONS, PERIOD_TITLE } from '@/lib/stats-period';
import { ChipStrip } from './states';

/*
 * The pieces the lake's two rankings share (clasament, standuri): the period chips, the quiet
 * in-card lines, the ranking's kg format, the ranked row, the period's side card and the skeleton
 * rows (fish PeriodChips, StatisticiSkeleton / ClasamentSkeleton). The error and empty cards are the
 * kit's ListError / ListEmpty.
 * TODO(kit): RowsSkeleton → ListSkeleton variant="rows" once it has a rank lead without the 56px
 * thumb; ChipsSkeleton → a kit chip-row skeleton (T1 has tabs / toolbar / filter-column ones only).
 */

const KG2 = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });

/**
 * A ranking's kg: always two decimals («124,37», «123,10», «6,00»), so the right-aligned tabular
 * column lines its commas up — fmtKg trims them («123,1»), which reads ragged in a column.
 */
export function rankKg(kg: number): string {
  return KG2.format(kg);
}

/** «1 captură», «12 capturi», «42 de capturi» — Romanian counts take «de» from 20 (formatCount). */
export const plural = (n: number, one: string, many: string) => formatCount(n, one, many);

/**
 * fish PeriodChips: three chips + a fixed spinner slot (a period switch in flight). `fill`: the
 * tray runs the content's full width (a page whose rows below are full width — Statistici), the
 * spinner slot inside it at the end, instead of a tray hugging its chips.
 */
export function PeriodChips({ value, onChange, busy, fill = false }: { value: StatsPeriod; onChange: (p: StatsPeriod) => void; busy: boolean; fill?: boolean }) {
  const spinner = <span className="flex size-6 shrink-0 items-center justify-center text-accent">{busy ? <T2Spinner className="size-5" /> : null}</span>;
  if (fill) {
    return (
      <div data-testid="period-chips">
        <ChipStrip fill className="flex items-center gap-2 pr-3">
          <ChoiceChips name="perioada" label="Perioadă" options={PERIOD_OPTIONS} value={value} onChange={onChange} />
          <span className="ml-auto">{spinner}</span>
        </ChipStrip>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2" data-testid="period-chips">
      <ChipStrip>
        <ChoiceChips name="perioada" label="Perioadă" options={PERIOD_OPTIONS} value={value} onChange={onChange} />
      </ChipStrip>
      {spinner}
    </div>
  );
}

/** A quiet centred line (fish caption gray5 paddingTop 48): the empty period, «Doar podiumul…». */
export function QuietNote({ children, className, testId }: { children: ReactNode; className?: string; testId?: string }) {
  return (
    <p className={cn('px-6 py-10 text-center t-body text-muted', className)} data-testid={testId}>
      {children}
    </p>
  );
}

/** The card the ranked rows sit on (fish: white, radius 15, CARD_SHADOW, hairlines between). */
export const ROWS_CARD = 'overflow-hidden rounded-card bg-surface shadow-e0';

/** Rows of grey bones in the rows card (fish RankedRowsCardSkeleton). */
export function RowsSkeleton({ rows = 6, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <ul aria-hidden className={cn(ROWS_CARD, 'divide-y divide-hairline')}>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <span className="size-6 shrink-0 animate-shimmer rounded-full" />
          {avatar ? <span className="size-8 shrink-0 animate-shimmer rounded-full" /> : null}
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="h-3.5 w-[55%] rounded-full bg-soft-fill" />
            <span className="h-3 w-[35%] rounded-full bg-soft-fill" />
          </span>
          <span className="h-3.5 w-14 shrink-0 rounded-full bg-soft-fill" />
        </li>
      ))}
    </ul>
  );
}

/** The stand ranking's grey shape: the count line, then the rows without avatars (fish StatisticiSkeleton). */
export function StandsSkeletonBody() {
  return (
    <div role="status" className="flex flex-col gap-2.5" data-testid="stands-skeleton">
      <span className="sr-only">Se încarcă standurile…</span>
      <span aria-hidden className="h-3.5 w-40 animate-shimmer rounded-full" />
      <RowsSkeleton rows={6} avatar={false} />
    </div>
  );
}

/** The chips row in grey (fish PeriodChipsSkeleton); `fill` as PeriodChips `fill`. */
export function ChipsSkeleton({ widths = ['w-24', 'w-16', 'w-28'], fill = false }: { widths?: string[]; fill?: boolean }) {
  return (
    <div aria-hidden className={cn('flex max-w-full gap-2 rounded-card bg-surface p-1.5 shadow-e0', fill ? 'w-full' : 'w-fit')}>
      {widths.map(w => (
        <span key={w} className={cn('h-9 animate-shimmer rounded-full', w)} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * The ranked row — anglers (from rank 4), species, stands
 * ---------------------------------------------------------------------------------------------- */

/**
 * The place of a ranked row — fish RankBadge (AnglersLeaderboardScreen rankColor): 1–3 the medal
 * chip (kit MEDAL: the navy digit on gold / silver / bronze, AA on every theme), 4+ a muted digit —
 * the same mark as the public water's Clasament and Statistici (ape-publice venue Rank), so the
 * two venues' rankings read alike.
 */
export function RankMark({ rank }: { rank: number }) {
  const medal = isMedalPlace(rank);
  return (
    <span className="flex w-6 shrink-0 justify-center">
      <span
        className={cn('flex size-6 items-center justify-center rounded-full tabular-nums', medal ? cn('t-micro-strong', MEDAL[rank]) : 't-label text-muted')}
        data-testid="rank"
        data-medal={medal ? rank : undefined}
      >
        <span className="sr-only">Locul </span>
        {rank}
      </span>
    </span>
  );
}

/**
 * One ranked line of the lake's rankings: the place (RankMark — the medals for 1–3), an optional
 * avatar, the name over its meta line, then the value in the ranking's stat step (t-stat) with its
 * unit beside it on the baseline (t-caption) — one gap (2.5).
 * TODO(kit): a generic `StatRankRow` in components/ranking (outside this task's scope).
 */
export function RankRow({
  rank,
  title,
  meta,
  value,
  unit,
  lead,
  href,
  label,
  muted = false,
  className,
  testId,
}: {
  rank: number;
  title: ReactNode;
  meta?: ReactNode;
  value: ReactNode;
  unit?: string;
  /** An avatar between the place and the name. */
  lead?: ReactNode;
  /** The row opens this (with `label` as its name). */
  href?: string;
  label?: string;
  /** The value means «nothing» («—», no weight): muted, as StatCell `muted`. */
  muted?: boolean;
  className?: string;
  testId?: string;
}) {
  const body = (
    <>
      <RankMark rank={rank} />
      {lead}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate t-body-strong text-ink">{title}</span>
        {meta ? <span className="t-caption text-muted">{meta}</span> : null}
      </span>
      {/* The unit inline on the number's baseline («161,52 kg», fish TopAnglerRow) — never a second
          stacked line that reads as another number and makes the row taller. */}
      <span className="flex shrink-0 items-baseline gap-1 text-right" data-testid="rank-value">
        <span className={cn('t-stat tabular-nums', muted ? 'text-muted' : 'text-ink')}>{value}</span>
        {unit ? <span className="t-caption text-muted">{unit}</span> : null}
      </span>
    </>
  );
  const row = 'flex items-center gap-2.5 px-4 py-3';
  return (
    <li className={className} data-testid={testId}>
      {href ? (
        <Link href={href} aria-label={label} className={cn(row, 'hover:bg-soft-fill focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent')}>
          {body}
        </Link>
      ) : (
        <div className={row}>{body}</div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------------------------------------
 * The period's side card — the same block on both rankings
 * ---------------------------------------------------------------------------------------------- */

/**
 * The right column's one block on clasament AND standuri (docked from 1280, one band under the list
 * below it): a carded section titled with the period, its numbers in one row of three (Total kg
 * with the catches under it · Partide · Pescari — never tall tiles with empty tracks), and the
 * sibling ranking for the same period as the section's action. `note` is a caption under the row.
 */
export function PeriodAside({
  period,
  totals,
  quiet,
  action,
  note,
  dimmed = false,
}: {
  period: StatsPeriod;
  /** The period's numbers; null → `quiet` (empty), or nothing (failed: the centre's error card is
   *  the page's one message — rule 4 — so the block keeps only its title and action). */
  totals: StatsTotals | null;
  quiet?: string;
  action: { href: string; label: string };
  note?: ReactNode;
  dimmed?: boolean;
}) {
  const totalKg = totals ? fmtKgStat(totals.totalKg) : null;
  return (
    <AsideSection
      title={PERIOD_TITLE[period]}
      className={cn('transition-opacity', dimmed && 'opacity-60')}
      action={
        <Link href={action.href} className={TEXT_ACTION}>
          {action.label}
        </Link>
      }
    >
      {totals && totalKg ? (
        <dl aria-label={`${PERIOD_TITLE[period]} în cifre`} className="grid grid-cols-3 divide-x divide-hairline" data-testid="period-totals">
          {/* A period total is read by magnitude, not to the gram: fmtKgStat («204 kg», «1,9 t»)
              fits a third of the card; rankKg's two decimals are for the ranked rows only. */}
          <StatCell label="Total" value={totalKg.value} unit={totalKg.unit} detail={plural(totals.catches, 'captură', 'capturi')} />
          <StatCell label="Partide" value={String(totals.partide)} />
          <StatCell label="Pescari" value={String(totals.anglers)} />
        </dl>
      ) : quiet ? (
        <p className="t-caption text-muted" data-testid="period-totals-quiet">
          {quiet}
        </p>
      ) : null}
      {note ? <p className="t-caption text-muted">{note}</p> : null}
    </AsideSection>
  );
}

/**
 * One figure of a `<dl>` row of three (divide-x): the caption over the number in the ranking's stat
 * step (t-stat) with its unit beside it. The lake's pages draw every «partide · capturi · kg» row
 * with it (the rankings' side card, Partide's history cards), so the same totals read at one step
 * on adjacent pages. `muted`: a value that means «nothing» («—»).
 */
export function StatCell({
  label,
  value,
  unit,
  detail,
  muted = false,
  centered = false,
}: {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  muted?: boolean;
  /** Centred in equal cells (a card's stats band) instead of starting on the row's edge. */
  centered?: boolean;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5', centered ? 'items-center px-1 text-center' : 'px-3 first:pl-0 last:pr-0')}>
      <dt className="truncate t-caption text-muted">{label}</dt>
      <dd className={cn('whitespace-nowrap t-stat tabular-nums', muted ? 'text-muted' : 'text-ink')}>
        {value}
        {unit ? <span className="ml-1 t-micro-strong text-muted">{unit}</span> : null}
      </dd>
      {detail ? <dd className="truncate t-micro text-muted">{detail}</dd> : null}
    </div>
  );
}
