'use client';

import { useEffect, useState } from 'react';
import type { CompetitionWithMyStatus, RankingMetadata, WeighingStatisticsItem } from '@/core/competitions';
import type { AllocatedParticipantsResponse, CompetitionActiveWeighing } from '@/core/organizer';
import { getCompetitorDisplayName } from '@/core/competitions';
import { parseStand, type RankingRowData } from '@/components/ranking';
import { formatInt, plural } from '@/components/cards/format';
import { LiveDot } from '@/components/templates/T1';
import { StatTile, BentoTile } from '@/components/ui/BentoTile';
import { cn } from '@/components/ui/cn';
import { SignatureNumber } from '@/components/ui/SignatureNumber';
import { EMPTY_STAND, formatKg } from './ranking';
import { StandMark } from './StandMark';
import { standLabel } from './stand';

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
 *  - The kit tiles as specified (BentoTile / StatTile: radius bento, 18px padding, min height,
 *    the kit label — the navy tile's in CountTile's caps, the others StatTile's), so this row is
 *    the same component as every other bento row.
 *  - Every tile has one anatomy: label, the number, a one-line caption.
 *  - Weights: one precision for the whole competition (weightDecimals), so the tiles line up.
 *  - No catches yet: no tiles of zeros — one line (SummaryStrip).
 */
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
}: {
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
  if (!metadata) return null;
  const completed = competition.competitionStatus === 'completed';
  if (metadata.totalCatchesCount === 0) return <SummaryStrip rankings={rankings} completed={completed} />;
  const tiles = summaryTiles(metadata, rankings, decimals);
  const hasWeighing = reserveWeighing || weighingsLoading || weighingsError || !!activeWeighing?.length || !!weighings?.length;
  return (
    <div
      className={cn(
        'hidden gap-3 md:grid md:grid-cols-2',
        hasWeighing ? 'xl:grid-cols-[1.35fr_1fr_1fr_1.1fr]' : 'xl:grid-cols-[1.35fr_1fr_1fr]',
      )}
    >
      {/* Three tiles on a tablet: the navy one takes the first row. */}
      <BiggestCatchTile {...tiles.biggest} decimals={decimals} className={hasWeighing ? undefined : 'md:max-xl:col-span-2'} />
      <StatTile
        tone="surface"
        label="Capturi"
        value={tiles.catches.value}
        caption={<span className="block truncate">{tiles.catches.caption}</span>}
        className={STAT_TILE}
      />
      <StatTile
        tone="surface"
        label="Cantitate totală"
        value={tiles.quantity.value}
        unit="kg"
        caption={<span className="block truncate">{tiles.quantity.caption}</span>}
        className={STAT_TILE}
      />
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
    </div>
  );
}

/** The tiles sit on the page ground: the kit's surface tone with the e0 hairline, like the cards under them. */
const STAT_TILE = 'shadow-e0';

type Big = RankingMetadata['biggestCatch'];

/**
 * A ranking without a single catch (live, or a finished one where everyone ended capot): no row of
 * display-size zeros, one line that says it.
 */
export function SummaryStrip({ rankings, completed, className }: { rankings: RankingRowData[] | undefined; completed: boolean; className?: string }) {
  const anglers = rankings?.filter(r => r.participant && r.participant !== EMPTY_STAND).length ?? 0;
  const parts = [
    completed ? 'Nicio captură înregistrată' : 'Nicio captură încă',
    anglers > 0 ? plural(anglers, 'pescar', 'pescari') : null,
    completed && anglers > 0 ? 'capot pentru toți' : null,
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
      caption: perStand ? `${plural(withFish, 'stand', 'standuri')} cu pește · ${stands - withFish} capot` : 'în tot concursul',
    },
    quantity: {
      value: formatKg(metadata.totalQuantity, decimals),
      caption: perStand ? `media pe stand ${formatKg(metadata.totalQuantity / stands, decimals)} kg` : 'în tot concursul',
    },
  };
}

/**
 * The navy tile: the biggest catch, the stand mark, the angler — the kit CountTile's anatomy (label,
 * the 64 «tile» number, caption) on BentoTile, with the stand mark in its caption.
 */
export function BiggestCatchTile({ big, weight, decimals, className }: { big: Big; weight: number | null; decimals: number; className?: string }) {
  const name = big
    ? getCompetitorDisplayName({
        teamName: big.teamName,
        participantNames: big.participants.map(p => p.username),
        guestName: big.guestName,
        fallback: '',
      })
    : '';
  const value = weight !== null ? formatKg(weight, decimals) : '–';
  return (
    <BentoTile tone="navy" className={className}>
      <div className="t-label tracking-[0.4px] text-lavender-2 uppercase">Cea mai mare captură</div>
      <SignatureNumber size="tile" tone="lavender" value={value} unit="kg" unitTone="lavender" />
      {big ? (
        <span className="flex min-w-0 items-center gap-2 t-caption">
          <StandMark sector={big.sectorName} stand={big.standName} tone="navy" />
          <span className="truncate text-lavender-3">{name}</span>
        </span>
      ) : null}
    </BentoTile>
  );
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

function WeighingTile({
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
}: {
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
}) {
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
  const current = active
    ? {
        sector: active.stand.sectors[0]?.name ?? '',
        stand: active.stand.name,
        name: allocatedName(allocated?.[active.stand.documentId]) ?? rankedName(active.stand.sectors[0]?.name ?? '', active.stand.name),
        since: open?.startDate ?? null,
        extra: active.weighingType !== 'normal',
      }
    : open && competition.competitionStatus === 'started'
      ? {
          sector: open.sectorName ?? '',
          stand: open.standName ?? '',
          name: rankedName(open.sectorName ?? '', open.standName ?? ''),
          since: open.startDate,
          extra: open.weighingType !== 'normal',
        }
      : null;
  const minutes = useMinutesSince(current?.since ?? null);
  const completed = competition.competitionStatus === 'completed';
  const failed = !current && !last && error && !loading;

  // The kit StatTile's anatomy in every case, so the four numbers of the row share a line: the label
  // row (with «Toate cântarele» at its end), the number (the weighing's total, or the stand while it
  // is being weighed), one caption line (who · where · how many).
  let number;
  let caption;
  if (current) {
    number = <SignatureNumber size="stat" value={standLabel(current.sector, current.stand)} />;
    caption = (
      <p className="truncate t-caption text-muted">
        {[current.name, minutes !== null ? `de ${minutes} min` : null].filter(Boolean).join(' · ') || '\u00a0'}
      </p>
    );
  } else if (last) {
    const name = rankedName(last.sectorName ?? '', last.standName ?? '');
    number = <SignatureNumber size="stat" value={formatKg(last.totalWeightKg, decimals)} unit="kg" />;
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
    number = <SignatureNumber size="stat" value={<span className="text-faint">–</span>} />;
    caption = (
      <p role={failed ? 'alert' : undefined} className="truncate t-caption text-muted">
        {failed ? 'Nu s-a putut încărca ultimul cântar.' : completed ? 'Niciun cântar înregistrat.' : 'Niciun cântar încă.'}
      </p>
    );
  }

  const link = 'shrink-0 cursor-pointer t-label text-accent-ink hover:underline';
  return (
    <BentoTile tone="surface" className={STAT_TILE}>
      <div className="flex min-w-0 items-center gap-2">
        {current ? (
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
    </BentoTile>
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
