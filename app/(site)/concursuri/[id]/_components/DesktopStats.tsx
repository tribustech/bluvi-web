'use client';

import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import type { CompetitionWithMyStatus, RankingMetadata, WeighingStatisticsItem } from '@/core/competitions';
import type { AllocatedParticipantsResponse, CompetitionActiveWeighing } from '@/core/organizer';
import { getCompetitorDisplayName } from '@/core/competitions';
import { parseStand, type RankingRowData } from '@/components/ranking';
import { formatInt, plural } from '@/components/cards/format';
import { LiveDot } from '@/components/templates/LiveDot';
import { KpiGrid, KpiTile } from '@/components/templates/T5/KpiGrid';
import { Avatar, FaceStack } from '@/components/ui/Avatar';
import { BentoTile } from '@/components/ui/BentoTile';
import { cn } from '@/components/ui/cn';
import { InlineNumber, SignatureNumber } from '@/components/ui/SignatureNumber';
import { ErrorState } from '@/components/surfaces/StateCard';
import { QueryRetry } from './QueryRetry';
import { EMPTY_STAND, formatKg } from './ranking';
import { StandMark } from './StandMark';
import { isNationalType, nationalStandLabel, standLabel } from './stand';

/*
 * Desktop «statistici sus» (design): biggest catch (the one navy tile), catches, total quantity,
 * and the weighing tile (in progress / last one, «Toate cântarele» → Cântare view). Numbers are the
 * ranking metadata fish shows in RankingCardsCarousel. The phone's Statistici view shows the same
 * three summary tiles (SummaryTiles).
 *
 *  - Four tiles once the competition has started (the weighing tile's slot is reserved by status,
 *    never by a read, so the grid is never repainted from three to four): two by two from 768
 *    (a quarter of a tablet row has no room for the kit's numbers), one row from 1280. The navy
 *    number is the 64 «tile» step everywhere, one step above the others.
 *  - The T5 KPI row (KpiGrid / KpiTile: the one KPI look of the product — Acasă, the operator
 *    panel, this page): radius bento, 18px padding, the navy `live` tile for the biggest catch,
 *    and subgrid rows, so the four numbers share one baseline whatever the captions do.
 *  - Always the strip over the views (CompetitionScreen): the Clasament tab has no side column at
 *    any width — the ranking table takes the whole column (ROADMAP §4).
 *  - Several weighings at once (fish MultipleActiveWeighingsBanner, parity shell.c24): the weighing
 *    tile says «Cântare în curs» and lists every stand, each a way to its weighing — the phone's
 *    banner is hidden from 768, so this tile is the only place they show.
 *  - Every tile has one anatomy: label, the number, a caption.
 *  - Weights: one precision for the whole competition (weightDecimals), so the tiles line up.
 *  - No catches yet: no tiles of zeros — one line (SummaryStrip).
 *  - From 1280 on the Statistici view the strip steps aside (its bento, `data-stats-bento`, says the
 *    same numbers) — the weighing tile included: the bento draws it as one of its own tiles, from the
 *    props this strip hands over (useWeighingSlot), so «Cântar în curs» / «Ultimul cântar» and the
 *    stands being weighed are never lost at any width.
 */

/*
 * The weighing tile's props, handed from the strip (which owns the page's weighing reads and the
 * «Toate cântarele» navigation) to the Statistici bento, its sibling under CompetitionScreen. One
 * competition page is mounted at a time, so one slot; published in a layout effect, so the bento
 * has it before its first paint.
 */
type WeighingSlot = Omit<WeighingTileProps, 'className' | 'standalone'> | null;
let weighingSlot: WeighingSlot = null;
const slotListeners = new Set<() => void>();
function publishWeighingSlot(next: WeighingSlot) {
  weighingSlot = next;
  for (const l of slotListeners) l();
}
function subscribeWeighingSlot(listener: () => void) {
  slotListeners.add(listener);
  return () => void slotListeners.delete(listener);
}
/** The weighing tile's props while the strip over the views can show it (null otherwise). */
export function useWeighingSlot(): WeighingSlot {
  return useSyncExternalStore(subscribeWeighingSlot, () => weighingSlot, () => null);
}

export function DesktopStats({
  metadata,
  rankings,
  competition,
  activeWeighing,
  weighings,
  weighingsLoading,
  weighingsError,
  onRetryWeighings,
  allocated,
  onAllWeighings,
  reserveWeighing,
  decimals,
  rankingPending = false,
  rankingFailed = false,
  rankingRetrying = false,
  onRetryRanking,
}: {
  /** The ranking re-read is running (its retry is busy). */
  rankingRetrying?: boolean;
  /** Re-reads the ranking (the only failure message on Cântare / Statistici / Toți peștii). */
  onRetryRanking?: () => void;
  /** The ranking (its metadata) is still being read in the browser: the row's bones hold its place. */
  rankingPending?: boolean;
  /** The ranking read failed with nothing to show: the slot stays, with one line that says so. */
  rankingFailed?: boolean;
  /** Started / completed: the weighing tile's column is always there (no 3 → 4 repaint). */
  reserveWeighing: boolean;
  /** The competition's weight precision (weightDecimals). */
  decimals: number;
  metadata: RankingMetadata | undefined;
  rankings: RankingRowData[] | undefined;
  competition: CompetitionWithMyStatus;
  activeWeighing: CompetitionActiveWeighing[] | undefined;
  weighings: WeighingStatisticsItem[] | undefined;
  /** The weighing statistics are still loading: the tile shows a skeleton, not the empty copy. */
  weighingsLoading: boolean;
  /** The weighing statistics could not be read (nothing cached): an error line with a retry, not «no weighing». */
  weighingsError: boolean;
  onRetryWeighings: () => void;
  allocated: AllocatedParticipantsResponse | undefined;
  onAllWeighings: () => void;
}) {
  const hasWeighing = reserveWeighing || weighingsLoading || weighingsError || !!activeWeighing?.length || !!weighings?.length;
  const showsTiles = !!metadata && metadata.totalCatchesCount > 0;
  // Every render: the bento's copy of the weighing tile follows this one (polls, retries, the allocation).
  useLayoutEffect(() => {
    publishWeighingSlot(
      showsTiles && hasWeighing
        ? {
            rankings,
            competition,
            activeWeighing,
            weighings,
            loading: weighingsLoading,
            error: weighingsError,
            onRetry: onRetryWeighings,
            allocated,
            onAllWeighings,
            decimals,
          }
        : null,
    );
  });
  useEffect(() => () => publishWeighingSlot(null), []);
  if (!metadata) {
    // Read in the browser (a slow server prefetch, or the start flipping the page to live): the row's
    // own shape holds its place, so the views under it never move when it lands.
    if (rankingPending) return <StatRowBones />;
    if (rankingFailed) {
      return (
        <ErrorState
          title="Rezumatul concursului nu a putut fi încărcat."
          action={onRetryRanking ? <QueryRetry fetching={rankingRetrying} failed onRetry={onRetryRanking} size="compact" /> : undefined}
        />
      );
    }
    return null;
  }
  const completed = competition.competitionStatus === 'completed';
  if (metadata.totalCatchesCount === 0) return <SummaryStrip rankings={rankings} completed={completed} />;
  const tiles = summaryTiles(metadata, rankings, decimals);
  const big = tiles.biggest;
  const value = big.weight !== null ? formatKg(big.weight, decimals) : '–';
  return (
    <KpiGrid
      label="Concursul pe scurt"
      columns="pair"
      // Two by two from 768 (a quarter of a tablet row has no room for the kit's numbers), one row
      // from 1280. From 1280 the Statistici view draws these numbers — and the weighing tile, from
      // useWeighingSlot — as its bento (owner rule 9, StatisticsView MetaTiles, marked
      // data-stats-bento): the strip steps aside there, so nothing is on one screen twice.
      className={cn(
        hasWeighing ? 'xl:grid-cols-[1.35fr_1fr_1fr_1.1fr]' : 'xl:grid-cols-[1.35fr_1fr_1fr]',
        'xl:[body:has([data-stats-bento])_&]:hidden',
      )}
    >
      <KpiTile
        live
        label="Cea mai mare captură"
        value={value}
        unit="kg"
        detail={big.big ? <BiggestCatchWho big={big.big} national={isNationalType(competition.rankingType)} /> : undefined}
        // Three tiles on a tablet: the navy one takes the first row.
        className={hasWeighing ? undefined : 'md:max-xl:col-span-2'}
      />
      <KpiTile label="Capturi" value={tiles.catches.value} detail={tiles.catches.caption} />
      <KpiTile label="Cantitate totală" value={tiles.quantity.value} unit="kg" detail={tiles.quantity.caption} />
      {hasWeighing ? (
        <WeighingTile
          rankings={rankings}
          competition={competition}
          activeWeighing={activeWeighing}
          weighings={weighings}
          loading={weighingsLoading}
          error={weighingsError}
          onRetry={onRetryWeighings}
          allocated={allocated}
          onAllWeighings={onAllWeighings}
          decimals={decimals}
        />
      ) : null}
    </KpiGrid>
  );
}

/**
 * The stat row while the ranking is read: the four tiles' anatomy in grey (label, number, caption),
 * two by two from 768, one row from 1280 — the page skeleton's row too (CompetitionSkeleton).
 */
export function StatRowBones() {
  return (
    <div
      role="status"
      aria-label="Se încarcă rezumatul concursului"
      // On the Statistici view from 1280 the bento's own bones hold the place (data-stats-bento), as
      // the loaded strip steps aside for the bento.
      className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr_1.1fr] xl:[body:has([data-stats-bento])_&]:hidden"
    >
      {[0, 1, 2, 3].map(i => (
        <BentoTile key={i} tone="surface" className="shadow-e0">
          <Bone className="w-28 max-w-full t-label" />
          <Bone className={i === 0 ? 'w-40 t-num-64' : 'w-24 t-num-40'} />
          <Bone className="w-36 max-w-full t-caption" />
        </BentoTile>
      ))}
    </div>
  );
}

/**
 * The navy tile's caption: the stand mark and the angler. A national championship names the stand
 * by its draw («A3(10)», fish formatNationalStand, statistici.c3), as the weighing tile beside it.
 */
function BiggestCatchWho({ big, national }: { big: NonNullable<Big>; national: boolean }) {
  const name = getCompetitorDisplayName({
    teamName: big.teamName,
    participantNames: big.participants.map(p => p.username),
    guestName: big.guestName,
    fallback: '',
  });
  return (
    <span className="flex min-w-0 items-center gap-2">
      {national ? (
        <span className="shrink-0 t-label whitespace-nowrap text-lavender">
          <span className="sr-only">Stand </span>
          {nationalStandLabel(big.sectorName, big.sectorDrawPosition, big.standName)}
        </span>
      ) : (
        <StandMark sector={big.sectorName} stand={big.standName} tone="navy" />
      )}
      <span className="truncate">{name}</span>
    </span>
  );
}

type Big = RankingMetadata['biggestCatch'];

/**
 * A ranking without a single catch (live, or a finished one where nobody caught): no row of
 * display-size zeros, one line that says it. The UI never says «capot» (owner rule 11).
 */
export function SummaryStrip({ rankings, completed, className }: { rankings: RankingRowData[] | undefined; completed: boolean; className?: string }) {
  const anglers = rankings?.filter(r => r.participant && r.participant !== EMPTY_STAND).length ?? 0;
  const parts = [
    completed ? 'Nicio captură înregistrată' : 'Nicio captură încă',
    anglers > 0 ? plural(anglers, 'pescar', 'pescari') : null,
  ].filter(Boolean);
  return (
    <p role="status" className={cn('rounded-card bg-surface px-5 py-3.5 t-body text-ink-2 shadow-e0', className)}>
      {parts.join(' · ')}
    </p>
  );
}

/**
 * The summary numbers and their captions, from the ranking metadata (at least one catch). A ranking
 * whose rows the web cannot show (the club rankings) still has the metadata totals: the captions
 * never count stands from rows that are not there («0 standuri cu pește» under 795 catches).
 */
export function summaryTiles(metadata: RankingMetadata, rankings: RankingRowData[] | undefined, decimals: number) {
  const big = metadata.biggestCatch;
  // fish RankingMetaCard falls back to `biggestFish` when the catch itself is not resolved.
  const biggestWeight = big ? big.weight : metadata.biggestFish > 0 ? metadata.biggestFish : null;
  const catches = metadata.totalCatchesCount;
  const stands = rankings?.length ?? 0;
  const withFish = rankings?.filter(r => typeof r.catchCount === 'number' && r.catchCount > 0).length ?? 0;
  const perStand = stands > 0 && catches > 0;
  return {
    biggest: { big, weight: biggestWeight },
    catches: {
      value: formatInt(catches),
      // No-break spaces inside each figure group («6 fără capturi»): a wrap never orphans a word.
      caption: perStand ? `${plural(withFish, 'stand', 'standuri')} cu pește · ${stands - withFish}\u00a0fără\u00a0capturi` : 'în tot concursul',
    },
    quantity: {
      value: formatKg(metadata.totalQuantity, decimals),
      // Owner rule 10: the figure is its own element, the unit smaller and muted beside it.
      caption: perStand ? (
        <>
          media pe stand <InlineNumber value={formatKg(metadata.totalQuantity / stands, decimals)} unit="kg" />
        </>
      ) : (
        'în tot concursul'
      ),
    },
  };
}

/**
 * The navy tile: the biggest catch, the stand mark, the angler — the kit CountTile's anatomy (label,
 * the 64 «tile» number, caption) on BentoTile, with the stand mark in its caption. With `faces` (the
 * registration on that stand: the Statistici bento, where the tile is 2×2 from 1280) the caption is
 * the angler's face beside the name and the stand, so the big tile carries what it knows instead of
 * one line under an empty field of navy.
 */
export function BiggestCatchTile({
  big,
  weight,
  decimals,
  national = false,
  faces,
  className,
}: {
  big: Big;
  weight: number | null;
  decimals: number;
  /** nationalChampionship (fish RankingCardsCarousel): the stand is the draw label «A3(12)». */
  national?: boolean;
  /** The people on the catch's stand (photo, else initials). */
  faces?: { name: string; src: string | null }[];
  className?: string;
}) {
  const name = big
    ? getCompetitorDisplayName({
        teamName: big.teamName,
        participantNames: big.participants.map(p => p.username),
        guestName: big.guestName,
        fallback: '',
      })
    : '';
  const value = weight !== null ? formatKg(weight, decimals) : '–';
  const stand = big ? (
    national ? (
      <span className="shrink-0 t-label whitespace-nowrap text-lavender">
        <span className="sr-only">Stand </span>
        {nationalStandLabel(big.sectorName, big.sectorDrawPosition, big.standName)}
      </span>
    ) : (
      <StandMark sector={big.sectorName} stand={big.standName} tone="navy" />
    )
  ) : null;
  return (
    <BentoTile tone="navy" className={className}>
      <div className="t-eyebrow text-lavender-2 uppercase">Cea mai mare captură</div>
      <SignatureNumber size="tile" tone="lavender" value={value} unit="kg" unitTone="lavender" />
      {big && faces?.length ? (
        <span className="flex min-w-0 items-center gap-3">
          {faces.length === 1 ? (
            <Avatar name={faces[0].name} src={faces[0].src} size={44} className="shrink-0" />
          ) : (
            <FaceStack people={faces.slice(0, 4)} size={32} className="shrink-0" />
          )}
          <span className="flex min-w-0 flex-col gap-1">
            <span className="truncate t-body-strong text-lavender">{name}</span>
            <span className="flex min-w-0 items-center gap-2 t-caption">{stand}</span>
          </span>
        </span>
      ) : big ? (
        <span className="flex min-w-0 items-center gap-2 t-caption">
          {stand}
          <span className="truncate text-lavender-3">{name}</span>
        </span>
      ) : null}
    </BentoTile>
  );
}

/** KpiTile's number row: on the grid's shared baseline, never wrapped. */
const NUMBER_ROW = 'self-baseline whitespace-nowrap';

/** Minutes since `iso`, refreshed every 30 s; null on the server and before mount. */
function useMinutesSince(iso: string | null): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!iso) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [iso]);
  if (!iso || now === null) return null;
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
}

interface WeighingTileProps {
  className?: string;
  /**
   * Drawn on its own (the Statistici bento), not as one of KpiGrid's subgrid tiles: the same
   * anatomy as a flex column, as tall as its bento row.
   */
  standalone?: boolean;
  rankings: RankingRowData[] | undefined;
  competition: CompetitionWithMyStatus;
  activeWeighing: CompetitionActiveWeighing[] | undefined;
  weighings: WeighingStatisticsItem[] | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  allocated: AllocatedParticipantsResponse | undefined;
  onAllWeighings: () => void;
  decimals: number;
}

export function WeighingTile({
  rankings,
  competition,
  activeWeighing,
  weighings,
  loading,
  error,
  onRetry,
  allocated,
  onAllWeighings,
  decimals,
  className,
  standalone = false,
}: WeighingTileProps) {
  // The angler on a stand, from the ranking rows (public), when the allocation is not loaded.
  const rankedName = (sector: string, stand: string): string | null => {
    const key = standLabel(sector, stand).toUpperCase();
    const row = rankings?.find(r => {
      const p = parseStand(r.position);
      return standLabel(p.sector, p.stand).toUpperCase() === key;
    });
    return row && row.participant !== EMPTY_STAND ? row.participant || null : null;
  };
  const sorted = [...(weighings ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const open = [...sorted].reverse().find(w => !w.endDate) ?? null;
  const last = [...sorted].reverse().find(w => w.endDate) ?? null;
  // Signed in: the per-user active-weighing read (fish ActiveWeighingBanner); otherwise the public
  // weighing statistics' open session.
  const active = activeWeighing?.[0];
  // The national rankings (nationalChampionship / fipsed) name a stand «A3(12)» everywhere on the page.
  const isNc = isNationalType(competition.rankingType);
  const activeLabel = (w: CompetitionActiveWeighing) =>
    isNc
      ? nationalStandLabel(w.stand.sectors[0]?.name, w.stand.sectorDrawPosition, w.stand.name)
      : standLabel(w.stand.sectors[0]?.name ?? '', w.stand.name);
  const current = active
    ? {
        label: activeLabel(active),
        name: allocatedName(allocated?.[active.stand.documentId]) ?? rankedName(active.stand.sectors[0]?.name ?? '', active.stand.name),
        since: open?.startDate ?? null,
        extra: active.weighingType !== 'normal',
      }
    : open && competition.competitionStatus === 'started'
      ? {
          label: standLabel(open.sectorName ?? '', open.standName ?? ''),
          name: rankedName(open.sectorName ?? '', open.standName ?? ''),
          since: open.startDate,
          extra: open.weighingType !== 'normal',
        }
      : null;
  // Several weighings at once (signed in, fish MultipleActiveWeighingsBanner): every stand, each
  // a way to its weighing (the Cântare view until the stand's live page exists).
  const many = (activeWeighing?.length ?? 0) > 1 ? (activeWeighing ?? []) : null;
  const minutes = useMinutesSince(current?.since ?? null);
  const completed = competition.competitionStatus === 'completed';
  const failed = !current && !last && error && !loading;

  // The kit StatTile's anatomy in every case, so the four numbers of the row share a line: the label
  // row (with «Toate cântarele» at its end), the number (the weighing's total, or the stand while it
  // is being weighed), one caption line (who · where · how many).
  let number;
  let caption;
  if (many) {
    number = (
      <ul aria-label="Standuri în cântare" className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 self-baseline">
        {many.map((w, i) => (
          <li key={w.stand.documentId ?? i}>
            <button
              type="button"
              onClick={onAllWeighings}
              aria-label={`Vezi ${w.weighingType === 'normal' ? 'cântarul live' : 'extra-cântarul live'} pe standul ${activeLabel(w)}`}
              className="cursor-pointer rounded-control t-num-26 whitespace-nowrap text-ink hover:text-accent-ink hover:underline"
            >
              {activeLabel(w)}
            </button>
          </li>
        ))}
      </ul>
    );
    caption = <p className="truncate t-caption text-muted">{`${plural(many.length, 'stand', 'standuri')} în cântare acum`}</p>;
  } else if (current) {
    number = <SignatureNumber size="stat" value={current.label} className={NUMBER_ROW} />;
    caption = (
      <p className="truncate t-caption text-muted">
        {[current.name, minutes !== null ? `de ${minutes} min` : null].filter(Boolean).join(' · ') || '\u00a0'}
      </p>
    );
  } else if (last) {
    const name = rankedName(last.sectorName ?? '', last.standName ?? '');
    number = <SignatureNumber size="stat" value={formatKg(last.totalWeightKg, decimals)} unit="kg" className={NUMBER_ROW} />;
    caption = (
      <p className="flex min-w-0 items-center gap-1.5 t-caption text-muted">
        {name ? <span className="min-w-0 truncate">{name} ·</span> : null}
        <StandMark sector={last.sectorName ?? ''} stand={last.standName ?? ''} />
        <span className="shrink-0 whitespace-nowrap">· {plural(last.catchCount, 'captură', 'capturi')}</span>
      </p>
    );
  } else if (loading) {
    // The loaded geometry in grey: the number line and the caption line, announced once.
    number = (
      <span role="status" aria-label="Se încarcă cântarele…">
        <Bone className="w-24 t-num-40" />
      </span>
    );
    caption = <Bone className="w-3/4 t-caption" />;
  } else {
    number = <SignatureNumber size="stat" value={<span className="text-faint">–</span>} className={NUMBER_ROW} />;
    caption = (
      <p role={failed ? 'alert' : undefined} className="truncate t-caption text-muted">
        {failed ? 'Nu s-a putut încărca ultimul cântar.' : completed ? 'Niciun cântar înregistrat.' : 'Niciun cântar încă.'}
      </p>
    );
  }

  const link = 'shrink-0 cursor-pointer t-label text-accent-ink hover:underline';
  return (
    // KpiTile's anatomy (three subgrid rows on KpiGrid's tracks), with a link in its label row.
    <div
      className={cn(
        'min-w-0 gap-2 rounded-bento bg-surface p-4.5 shadow-e0',
        standalone ? 'flex h-full min-h-39 flex-col justify-between' : 'row-span-3 grid grid-rows-subgrid',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {many ? (
          <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate t-label text-live">
            <LiveDot />
            Cântare în curs
          </span>
        ) : current ? (
          <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate t-label text-live">
            <LiveDot />
            {current.extra ? 'Extra-cântar în curs' : 'Cântar în curs'}
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate t-label text-muted">Ultimul cântar</span>
        )}
        {failed ? (
          <button type="button" onClick={onRetry} className={link}>
            Încearcă din nou
          </button>
        ) : (
          <button type="button" onClick={onAllWeighings} className={link}>
            Toate cântarele
          </button>
        )}
      </div>
      {number}
      {caption}
    </div>
  );
}

/** A text bone inside a line of the given type step, so it is exactly as tall as the loaded text. */
function Bone({ className }: { className: string }) {
  return (
    <span aria-hidden className={cn('relative block max-w-full', className)}>
      &nbsp;
      <span className="absolute inset-x-0 top-1/2 h-[0.62em] -translate-y-1/2 animate-shimmer rounded-full" />
    </span>
  );
}

function allocatedName(a: AllocatedParticipantsResponse[string] | undefined): string | null {
  if (!a) return null;
  return getCompetitorDisplayName({ teamName: a.teamName, participantNames: a.participants.map(p => p.name), guestName: a.guestName, fallback: '' }) || null;
}
