'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { CompetitionWithMyStatus, RankingMetadata, WeighingStatisticsItem } from '@/core/competitions';
import type { AllocatedParticipantsResponse, CompetitionActiveWeighing } from '@/core/organizer';
import { getCompetitorDisplayName, type FeederRoundsRanking, type NationalChampionshipStandRanking } from '@/core/competitions';
import { parseStand, type RankingRowData } from '@/components/ranking';
import { formatInt, plural } from '@/components/cards/format';
import { LiveDot } from '@/components/templates/LiveDot';
import { KpiGrid } from '@/components/templates/T5/KpiGrid';
import { Avatar, FaceStack } from '@/components/ui/Avatar';
import { ChartBarIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { FishIcon, ScaleIcon } from '@/components/icons/brand';
import { BENTO_ART_CLEAR, BENTO_INK, BentoArt, BentoTile, bentoSurface, type BentoTone } from '@/components/ui/BentoTile';
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
 *  - No catches yet: no tiles of zeros — one line (SummaryStrip), in the row's height.
 *  - The same strip on every view, at every width from 768: the view switcher under it never moves
 *    when the view changes. The Statistici bento keeps only the facts the strip does not show.
 *  - The weighing tile names the angler on the stand from the registrations (by the stand's
 *    documentId), then the feeder entrant on that stand in the current leg, then the ranking rows.
 */

export function DesktopStats({
  metadata,
  rankings,
  feederRows,
  ncClubs,
  competition,
  activeWeighing,
  weighings,
  weighingsLoading,
  weighingsError,
  onRetryWeighings,
  allocated,
  onAllWeighings,
  scaleHrefOf,
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
  /** Feeder legs: the entrants (each on its current leg's stand), for the weighing tile's name. */
  feederRows?: FeederRoundsRanking[];
  /** Club rankings (NC / FIPSed): the teams carry their stand and draw position («A3(10)»). */
  ncClubs?: NationalChampionshipStandRanking[];
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
  /**
   * The author / a referee of a running competition (organizer.b.active-weighing-banner): a weighing
   * in progress opens on the scale — the tile's link is «Deschide în cântar» (null: no stand sector).
   */
  scaleHrefOf?: (w: CompetitionActiveWeighing) => string | null;
}) {
  const hasWeighing = reserveWeighing || weighingsLoading || weighingsError || !!activeWeighing?.length || !!weighings?.length;
  if (!metadata) {
    // Read in the browser (a slow server prefetch, or the start flipping the page to live): the row's
    // own shape holds its place, so the views under it never move when it lands.
    if (rankingPending) return <StatRowBones tiles={reserveWeighing ? 4 : 3} />;
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
  // The bones' height (tile row), so a ranking that lands with no catch moves nothing under it.
  if (metadata.totalCatchesCount === 0) return <SummaryStrip rankings={rankings} completed={completed} slot />;
  const tiles = summaryTiles(metadata, rankings, decimals, entrantCounts(rankings, feederRows, ncClubs));
  const big = tiles.biggest;
  const value = big.weight !== null ? formatKg(big.weight, decimals) : '–';
  return (
    <KpiGrid
      label="Concursul pe scurt"
      columns="pair"
      // Two by two from 768 (a quarter of a tablet row has no room for the kit's numbers), one row
      // from 1280 — on every view (the Statistici bento only adds the facts this row does not say).
      className={hasWeighing ? 'xl:grid-cols-[1.35fr_1fr_1fr_1.1fr]' : 'xl:grid-cols-[1.35fr_1fr_1fr]'}
    >
      <HeadlineTile
        tone="signature"
        art={<TrophyIcon />}
        label="Cea mai mare captură"
        value={value}
        unit="kg"
        detail={big.big ? <BiggestCatchWho big={big.big} national={isNationalType(competition.rankingType)} /> : undefined}
        // Three tiles on a tablet: the navy one takes the first row.
        className={hasWeighing ? undefined : 'md:max-xl:col-span-2'}
      />
      <HeadlineTile
        tone="lavender"
        art={<FishIcon />}
        label="Capturi"
        value={tiles.catches.value}
        detail={tiles.catches.facts.length ? <Facts items={tiles.catches.facts} /> : undefined}
      />
      <HeadlineTile
        tone="indigo"
        art={<ChartBarIcon />}
        label="Cantitate totală"
        value={tiles.quantity.value}
        unit="kg"
        // Nothing to back a caption (no rows, no entrants): no stock phrase (rule 4).
        detail={tiles.quantity.perStand !== null ? <PerStand value={tiles.quantity.perStand} per={tiles.quantity.per} tone="indigo" /> : undefined}
      />
      {hasWeighing ? (
        <WeighingTile
          rankings={rankings}
          entrants={standEntrants(feederRows, ncClubs)}
          competition={competition}
          activeWeighing={activeWeighing}
          weighings={weighings}
          loading={weighingsLoading}
          error={weighingsError}
          onRetry={onRetryWeighings}
          allocated={allocated}
          onAllWeighings={onAllWeighings}
          scaleHrefOf={scaleHrefOf}
          decimals={decimals}
        />
      ) : null}
    </KpiGrid>
  );
}

/**
 * The stat row while the ranking is read: the tiles' anatomy in grey (label, number, caption), two
 * by two from 768, one row from 1280 — the page skeleton's row too (CompetitionSkeleton). Four when
 * the weighing slot is reserved (started / completed), else three, the navy one across the first
 * tablet row — the loaded row's exact grid either way.
 */
export function StatRowBones({ tiles = 4 }: { tiles?: 3 | 4 }) {
  const four = tiles === 4;
  return (
    <div
      role="status"
      aria-label="Se încarcă rezumatul concursului"
      className={cn('grid gap-3 md:grid-cols-2', four ? 'xl:grid-cols-[1.35fr_1fr_1fr_1.1fr]' : 'xl:grid-cols-[1.35fr_1fr_1fr]')}
    >
      {Array.from({ length: tiles }, (_, i) => (
        <BentoTile key={i} tone="surface" className={cn('shadow-e0', i === 0 && !four && 'md:max-xl:col-span-2')}>
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
export function SummaryStrip({
  rankings,
  completed,
  slot = false,
  className,
}: {
  rankings: RankingRowData[] | undefined;
  completed: boolean;
  /**
   * The strip over the views (from 768): it takes the stat row's height (StatRowBones — one 156
   * row from 1280, two rows and their gap on a tablet), so the bones it replaces, and the tiles that
   * replace it on the first catch, move nothing under it (CLS).
   */
  slot?: boolean;
  className?: string;
}) {
  const anglers = rankings?.filter(r => r.participant && r.participant !== EMPTY_STAND).length ?? 0;
  const parts = [
    completed ? 'Nicio captură înregistrată' : 'Nicio captură încă',
    anglers > 0 ? plural(anglers, 'pescar', 'pescari') : null,
  ].filter(Boolean);
  return (
    <p
      role="status"
      data-summary-strip
      className={cn('rounded-card bg-surface px-5 py-3.5 t-body text-ink-2 shadow-e0', slot && 'flex min-h-81 items-center xl:min-h-39', className)}
    >
      {parts.join(' · ')}
    </p>
  );
}

/**
 * Who the catches are counted over: the ranking's stands, else (no stand rows) the feeder entrants
 * (a crew or an angler, on another stand every leg) or the club rankings' teams (each on a stand).
 * Null when none of them is there: the captions say nothing rather than a stock phrase (rule 4).
 */
export type EntrantCounts = { total: number; withFish: number; one: string; many: string };

export function entrantCounts(
  rankings: RankingRowData[] | undefined,
  feederRows?: FeederRoundsRanking[],
  ncClubs?: NationalChampionshipStandRanking[],
): EntrantCounts | null {
  const caught = (r: { catchCount?: unknown }) => typeof r.catchCount === 'number' && r.catchCount > 0;
  if (rankings?.length) return { total: rankings.length, withFish: rankings.filter(caught).length, one: 'stand', many: 'standuri' };
  if (feederRows?.length) {
    const crews = feederRows.some(r => !!r.teamName || r.participants.length > 1);
    return {
      total: feederRows.length,
      withFish: feederRows.filter(caught).length,
      ...(crews ? { one: 'echipă', many: 'echipe' } : { one: 'participant', many: 'participanți' }),
    };
  }
  const teams = ncClubs?.flatMap(c => c.teams ?? []) ?? [];
  if (teams.length) return { total: teams.length, withFish: teams.filter(caught).length, one: 'stand', many: 'standuri' };
  return null;
}

/**
 * The summary numbers and their captions, from the ranking metadata (at least one catch). A ranking
 * whose rows the web cannot show (the club rankings) still has the metadata totals: the captions
 * never count stands from rows that are not there («0 standuri cu pește» under 795 catches) — they
 * count the feeder entrants / club teams when given (`counts`), else say nothing.
 */
export function summaryTiles(
  metadata: RankingMetadata,
  rankings: RankingRowData[] | undefined,
  decimals: number,
  counts: EntrantCounts | null = entrantCounts(rankings),
) {
  const big = metadata.biggestCatch;
  // fish RankingMetaCard falls back to `biggestFish` when the catch itself is not resolved.
  const biggestWeight = big ? big.weight : metadata.biggestFish > 0 ? metadata.biggestFish : null;
  const catches = metadata.totalCatchesCount;
  const per = counts && counts.total > 0 && catches > 0 ? counts : null;
  return {
    biggest: { big, weight: biggestWeight },
    catches: {
      value: formatInt(catches),
      /** «21 de standuri cu pește», «0 fără capturi»: two facts, laid out apart (Facts), never a dangling «·». */
      facts: per ? [`${plural(per.withFish, per.one, per.many)} cu pește`, `${per.total - per.withFish} fără capturi`] : [],
    },
    quantity: {
      value: formatKg(metadata.totalQuantity, decimals),
      /** The average per stand / entrant (formatted), when there are any. */
      perStand: per ? formatKg(metadata.totalQuantity / per.total, decimals) : null,
      /** What the average is over: «stand», «echipă», «participant». */
      per: per?.one ?? 'stand',
    },
  };
}

/**
 * Facts of one caption line, «a · b · c». A wrap never leaves a «·» at the end of a line or starts
 * one with it: every fact carries its separator before it, and the list is pulled one separator
 * width to the left inside a clipping box, so the separator of whichever fact opens a line sits in
 * the clipped strip. The separators are real text (copy and innerText keep «·» between facts).
 */
export function Facts({ items, className }: { items: ReactNode[]; className?: string }) {
  return (
    <span className={cn('block overflow-hidden', className)}>
      <span className="-ms-4 flex flex-wrap items-center">
        {items.map((item, i) => (
          <span key={i} className="flex max-w-full min-w-0 items-center">
            {/* The first fact's separator is an empty slot: the clipped strip, never text. */}
            <span aria-hidden className="w-4 shrink-0 text-center">
              {i > 0 ? '·' : null}
            </span>
            {item}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * The navy tile: the biggest catch, the stand mark, the angler — the kit CountTile's anatomy (label,
 * the 64 «tile» number, caption) on BentoTile, with the stand mark in its caption. With `faces` (the
 * catch's entrant: the phone's Statistici bento) the caption is the angler's face beside the name
 * and the stand.
 */
export function BiggestCatchTile({
  big,
  weight,
  decimals,
  national = false,
  faces,
  art = false,
  className,
}: {
  /** The trophy as corner art (the Statistici bento, where the tile is 2×2). */
  art?: boolean;
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
    <BentoTile tone="signature" art={art ? <TrophyIcon /> : undefined} className={className}>
      <div className="t-eyebrow text-lavender-2 uppercase">Cea mai mare captură</div>
      <SignatureNumber size="tile" tone="lavender" value={value} unit="kg" unitTone="lavender" />
      {big && faces?.length ? (
        <span className={cn('flex min-w-0 items-center gap-3', art && BENTO_ART_CLEAR)}>
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
        <span className={cn('flex min-w-0 items-center gap-2 t-caption', art && BENTO_ART_CLEAR)}>
          {stand}
          <span className="truncate text-lavender-3">{name}</span>
        </span>
      ) : null}
    </BentoTile>
  );
}

/** KpiTile's number row: on the grid's shared baseline, never wrapped. */
const NUMBER_ROW = 'self-baseline whitespace-nowrap';

/**
 * «media pe stand 15,761 kg» on a bento surface (owner rule 10): the figure a step stronger, the unit
 * its own smaller word, both in the surface's AA tones.
 */
function PerStand({ value, per = 'stand', tone }: { value: string; per?: string; tone: BentoTone }) {
  return (
    <>
      media pe {per} <InlineNumber value={value} unit="kg" valueClassName={BENTO_INK[tone].inlineValue} unitClassName={BENTO_INK[tone].inlineUnit} />
    </>
  );
}

/**
 * One headline tile of the strip over the views: the T5 KpiTile anatomy (three subgrid rows on
 * KpiGrid's tracks — label, the number on the shared baseline, the detail) on its own bento surface
 * (owner rule 19): the navy signature for the biggest catch (the 64 step), the others at 40, each
 * with its icon as corner art.
 */
function HeadlineTile({
  tone,
  art,
  label,
  value,
  unit,
  detail,
  className,
}: {
  tone: BentoTone;
  art?: ReactNode;
  label: string;
  value: ReactNode;
  unit?: string;
  detail?: ReactNode;
  className?: string;
}) {
  const ink = BENTO_INK[tone];
  const signature = tone === 'signature';
  return (
    <div className={cn('row-span-3 grid min-w-0 grid-rows-subgrid gap-2 rounded-bento p-4.5', bentoSurface(tone), className)}>
      {art ? <BentoArt>{art}</BentoArt> : null}
      <p className={cn('truncate', signature ? 't-eyebrow uppercase' : 't-label')}>{label}</p>
      <SignatureNumber size={signature ? 'tile' : 'stat'} tone={ink.number} unitTone={ink.unit} value={value} unit={unit} className={NUMBER_ROW} />
      <p aria-hidden={detail ? undefined : true} className={cn('line-clamp-2 t-caption text-pretty', !!art && BENTO_ART_CLEAR, signature && 'text-lavender-3')}>
        {detail || ' '}
      </p>
    </div>
  );
}

/**
 * The weighing tile's surface, for the Statistici grid under the strip (owner rule 19: no tint twice
 * on one screen): rose while a weighing is in progress (the per-user active read, else the public
 * statistics' open session of a started competition — WeighingTile's `current`), violet for the last
 * one. The grid's Penalizări / Cantitate pe sector card takes the other of the two.
 */
export function weighingTileTone(
  activeWeighing: CompetitionActiveWeighing[] | undefined,
  weighings: WeighingStatisticsItem[] | undefined,
  status: CompetitionWithMyStatus['competitionStatus'],
): 'rose' | 'violet' {
  const open = status === 'started' && !!weighings?.some(w => !w.endDate);
  return activeWeighing?.length || open ? 'rose' : 'violet';
}

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
  rankings: RankingRowData[] | undefined;
  entrants: StandEntrant[] | null;
  competition: CompetitionWithMyStatus;
  activeWeighing: CompetitionActiveWeighing[] | undefined;
  weighings: WeighingStatisticsItem[] | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  allocated: AllocatedParticipantsResponse | undefined;
  onAllWeighings: () => void;
  scaleHrefOf?: (w: CompetitionActiveWeighing) => string | null;
  decimals: number;
}

function WeighingTile({
  rankings,
  entrants,
  competition,
  activeWeighing,
  weighings,
  loading,
  error,
  onRetry,
  allocated,
  onAllWeighings,
  scaleHrefOf,
  decimals,
  className,
}: WeighingTileProps) {
  // The angler on a stand, when the allocation is not loaded: the feeder / club-ranking entrant on
  // that stand (a feeder stand holds another entrant every leg, so never its registration: the
  // entrant's current leg), the registration on that stand (by the stand's documentId, as the
  // Statistici view's participantLabel), then the standard ranking rows (public).
  const rankedName = (sector: string, stand: string, standDocumentId?: string | null): string | null => {
    const entrant = entrantOn(entrants, sector, stand);
    if (entrant?.name) return entrant.name;
    if (competition.rankingType === 'feederRounds') return null;
    const reg = registrationOn(competition, sector, stand, standDocumentId);
    if (reg) {
      const name = getCompetitorDisplayName({
        teamName: reg.teamName,
        participantNames: reg.participants.map(p => p.username),
        guestName: reg.guestName,
        fallback: '',
      });
      if (name) return name;
    }
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
  // A stand named only by sector and stand (the public weighing statistics): the NC draw label from
  // the registration on it («A3(10)»), the plain «A10» otherwise.
  const weighedLabel = (sector: string, stand: string) =>
    isNc ? nationalStandLabel(sector, entrantOn(entrants, sector, stand)?.drawPosition, stand) : standLabel(sector, stand);
  const current = active
    ? {
        label: activeLabel(active),
        name:
          allocatedName(allocated?.[active.stand.documentId]) ??
          rankedName(active.stand.sectors[0]?.name ?? '', active.stand.name, active.stand.documentId),
        since: open?.startDate ?? null,
        extra: active.weighingType !== 'normal',
      }
    : open && competition.competitionStatus === 'started'
      ? {
          label: weighedLabel(open.sectorName ?? '', open.standName ?? ''),
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
        {many.map((w, i) => {
          const scale = scaleHrefOf?.(w) ?? null;
          const cls = 'cursor-pointer rounded-control t-num-26 whitespace-nowrap text-ink hover:text-accent-ink hover:underline';
          return (
            <li key={w.stand.documentId ?? i}>
              {scale ? (
                // A manager: each stand in progress opens on the scale.
                <Link href={scale} aria-label={`Deschide în cântar standul ${activeLabel(w)}`} className={cls}>
                  {activeLabel(w)}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={onAllWeighings}
                  aria-label={`Vezi ${w.weighingType === 'normal' ? 'cântarul live' : 'extra-cântarul live'} pe standul ${activeLabel(w)}`}
                  className={cls}
                >
                  {activeLabel(w)}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    );
    caption = <p className={cn('truncate t-caption', BENTO_ART_CLEAR)}>{`${plural(many.length, 'stand', 'standuri')} în cântare acum`}</p>;
  } else if (current) {
    number = <SignatureNumber size="stat" value={current.label} className={NUMBER_ROW} />;
    caption = (
      <p className={cn('truncate t-caption', BENTO_ART_CLEAR)}>
        {[current.name, minutes !== null ? `de ${minutes} min` : null].filter(Boolean).join(' · ') || '\u00a0'}
      </p>
    );
  } else if (last) {
    const name = rankedName(last.sectorName ?? '', last.standName ?? '');
    number = <SignatureNumber size="stat" value={formatKg(last.totalWeightKg, decimals)} unit="kg" unitTone="current" className={NUMBER_ROW} />;
    // Wraps (the name on its own line when it is long) rather than truncating it to a few letters
    // beside the art's reserved corner.
    caption = (
      <p className={cn('min-w-0 t-caption', BENTO_ART_CLEAR)}>
        <Facts
          items={[
            ...(name ? [<span key="name" className="min-w-0 truncate">{name}</span>] : []),
            isNc ? (
              <span key="stand" className="shrink-0 t-label whitespace-nowrap">
                <span className="sr-only">Stand </span>
                {weighedLabel(last.sectorName ?? '', last.standName ?? '')}
              </span>
            ) : (
              <StandMark key="stand" sector={last.sectorName ?? ''} stand={last.standName ?? ''} />
            ),
            <span key="count" className="whitespace-nowrap">{plural(last.catchCount, 'captură', 'capturi')}</span>,
          ]}
        />
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
      <p role={failed ? 'alert' : undefined} className={cn('truncate t-caption', BENTO_ART_CLEAR)}>
        {failed ? 'Nu s-a putut încărca ultimul cântar.' : completed ? 'Niciun cântar înregistrat.' : 'Niciun cântar încă.'}
      </p>
    );
  }

  const link = 'shrink-0 cursor-pointer rounded-control t-label text-accent-ink underline-offset-2 hover:underline';
  const currentScale = !many && active && scaleHrefOf ? scaleHrefOf(active) : null;
  // Owner rule 19: a weighing in progress is the rose tint (its live label in the tint's AA red),
  // the last weighing the violet one; the scale is the corner art (weighingTileTone).
  const tone: BentoTone = weighingTileTone(activeWeighing, weighings, competition.competitionStatus);
  return (
    // KpiTile's anatomy (three subgrid rows on KpiGrid's tracks), with a link in its label row.
    <div
      className={cn(
        'min-w-0 gap-2 rounded-bento p-4.5',
        bentoSurface(tone),
        'row-span-3 grid grid-rows-subgrid',
        className,
      )}
    >
      <BentoArt>
        <ScaleIcon />
      </BentoArt>
      <div className="flex min-w-0 items-center gap-2">
        {many ? (
          <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate t-label">
            <LiveDot />
            Cântare în curs
          </span>
        ) : current ? (
          <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate t-label">
            <LiveDot />
            {current.extra ? 'Extra-cântar în curs' : 'Cântar în curs'}
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate t-label">Ultimul cântar</span>
        )}
        {failed ? (
          <button type="button" onClick={onRetry} className={link}>
            Încearcă din nou
          </button>
        ) : currentScale ? (
          // A manager: the weighing in progress on the scale, in place of «Toate cântarele».
          <Link href={currentScale} className={link}>
            Deschide în cântar
          </Link>
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

type DetailReg = CompetitionWithMyStatus['registrations'][number];

/** The competition's stand by sector and stand name (the public weighing statistics name it so). */
function standDocumentIdOf(competition: CompetitionWithMyStatus, sector: string, stand: string): string | null {
  const key = standLabel(sector, stand).toUpperCase();
  for (const s of competition.sectors) {
    const hit = s.stands.find(st => standLabel(s.name, st.name).toUpperCase() === key);
    if (hit) return hit.documentId;
  }
  return null;
}

/** The registered entry on a stand: by the stand's documentId (given, or resolved from its names). */
function registrationOn(competition: CompetitionWithMyStatus, sector: string, stand: string, standDocumentId?: string | null): DetailReg | null {
  const doc = standDocumentId ?? standDocumentIdOf(competition, sector, stand);
  if (!doc) return null;
  return competition.registrations.find(r => r.registrationStatus === 'registered' && r.stand?.documentId === doc) ?? null;
}

/** Who sits on a stand by its names: the feeder entrants (their current leg) or the club rankings' teams. */
type StandEntrant = { key: string; name: string; drawPosition: number | null };

function standEntrants(feederRows: FeederRoundsRanking[] | undefined, ncClubs: NationalChampionshipStandRanking[] | undefined): StandEntrant[] | null {
  const nameOf = (r: { teamName?: string | null; guestName?: string | null; participants?: { username: string }[] | null; participant?: { username: string } | null }) =>
    getCompetitorDisplayName({
      teamName: r.teamName,
      participantNames: r.participants?.length ? r.participants.map(p => p.username) : r.participant ? [r.participant.username] : [],
      guestName: r.guestName,
      fallback: '',
    });
  if (feederRows) {
    return feederRows
      .filter(r => r.standName)
      .map(r => ({ key: standLabel(r.sectorName ?? '', r.standName ?? '').toUpperCase(), name: nameOf(r), drawPosition: r.sectorDrawPosition }));
  }
  if (ncClubs) {
    return ncClubs.flatMap(c =>
      (c.teams ?? []).map(t => ({ key: standLabel(t.sectorName, t.standName).toUpperCase(), name: nameOf(t), drawPosition: t.sectorDrawPosition ?? null })),
    );
  }
  return null;
}

function entrantOn(entrants: StandEntrant[] | null, sector: string, stand: string): StandEntrant | null {
  const key = standLabel(sector, stand).toUpperCase();
  return entrants?.find(e => e.key === key) ?? null;
}
