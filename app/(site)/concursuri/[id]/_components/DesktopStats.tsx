'use client';

import { useEffect, useState } from 'react';
import { ScaleIcon } from '@heroicons/react/24/outline';
import type { CompetitionWithMyStatus, RankingMetadata, WeighingStatisticsItem } from '@/core/competitions';
import type { AllocatedParticipantsResponse, CompetitionActiveWeighing } from '@/core/organizer';
import { getCompetitorDisplayName } from '@/core/competitions';
import { parseStand, type RankingRowData } from '@/components/ranking';
import { sectorFill } from '@/components/ranking/sector';
import { formatDecimal, formatInt, plural } from '@/components/cards/format';
import { CountTile, StatTile, BentoTile } from '@/components/ui/BentoTile';
import { FishIcon } from '@/components/icons/brand';
import { cn } from '@/components/ui/cn';
import { standLabel } from './stand';

/*
 * Desktop «statistici sus» (design): biggest catch (the one navy CountTile), catches, total
 * quantity, and the weighing tile (in progress / last one, «Toate cântarele» → Cântare view).
 * Numbers are the ranking metadata fish shows in RankingCardsCarousel.
 */
export function DesktopStats({
  metadata,
  rankings,
  competition,
  activeWeighing,
  weighings,
  weighingsLoading,
  allocated,
  onAllWeighings,
}: {
  metadata: RankingMetadata | undefined;
  rankings: RankingRowData[] | undefined;
  competition: CompetitionWithMyStatus;
  activeWeighing: CompetitionActiveWeighing[] | undefined;
  weighings: WeighingStatisticsItem[] | undefined;
  /** The weighing statistics are still loading: the tile shows a skeleton, not the empty copy. */
  weighingsLoading: boolean;
  allocated: AllocatedParticipantsResponse | undefined;
  onAllWeighings: () => void;
}) {
  if (!metadata) return null;
  const big = metadata.biggestCatch;
  const stands = rankings?.length ?? 0;
  const withFish = rankings?.filter(r => typeof r.catchCount === 'number' && r.catchCount > 0).length ?? 0;
  const capot = stands - withFish;
  const bigName = big
    ? getCompetitorDisplayName({
        teamName: big.teamName,
        participantNames: big.participants.map(p => p.username),
        guestName: big.guestName,
        fallback: '',
      })
    : '';

  return (
    <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr_1.1fr]">
      <CountTile
        label="Cea mai mare captură"
        // Empty: a muted 0 kg (an em-dash at display size reads as a bar), same baseline as the others.
        value={big ? formatDecimal(big.weight, 2, 3) : <span className="text-lavender-3">0</span>}
        unit="kg"
        caption={
          big ? (
            <span className="flex items-center gap-2">
              <SectorChip sector={big.sectorName} label={standLabel(big.sectorName, big.standName)} />
              <span className="truncate t-body-strong text-lavender">{bigName}</span>
            </span>
          ) : (
            'Nicio captură încă'
          )
        }
      />
      <StatTile
        tone="surface"
        icon={<FishIcon />}
        label="Capturi"
        value={formatInt(metadata.totalCatchesCount)}
        caption={stands ? `${plural(withFish, 'stand', 'standuri')} cu pește · ${capot} capot` : '0 standuri cu pește'}
      />
      <StatTile
        tone="surface"
        icon={<ScaleIcon />}
        label="Cantitate totală"
        value={formatDecimal(metadata.totalQuantity, 1, 1)}
        unit="kg"
        caption={stands ? `media pe stand ${formatDecimal(metadata.totalQuantity / stands, 1, 1)} kg` : 'Nicio captură încă'}
      />
      <WeighingTile
        rankings={rankings}
        competition={competition}
        activeWeighing={activeWeighing}
        weighings={weighings}
        loading={weighingsLoading}
        allocated={allocated}
        onAllWeighings={onAllWeighings}
      />
    </div>
  );
}

function SectorChip({ sector, label }: { sector: string; label: string }) {
  const fill = sectorFill(sector, 'var(--color-accent)');
  return (
    <span className={cn('inline-flex h-5.5 items-center rounded-sm px-1.5 t-micro-strong text-on-accent', fill.className)} style={fill.style}>
      {label}
    </span>
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
  allocated,
  onAllWeighings,
}: {
  rankings: RankingRowData[] | undefined;
  competition: CompetitionWithMyStatus;
  activeWeighing: CompetitionActiveWeighing[] | undefined;
  weighings: WeighingStatisticsItem[] | undefined;
  loading: boolean;
  allocated: AllocatedParticipantsResponse | undefined;
  onAllWeighings: () => void;
}) {
  // The angler on a stand, from the ranking rows (public), when the allocation is not loaded.
  const rankedName = (sector: string, stand: string): string | null => {
    const key = standLabel(sector, stand).toUpperCase();
    const row = rankings?.find(r => {
      const p = parseStand(r.position);
      return standLabel(p.sector, p.stand).toUpperCase() === key;
    });
    return row?.participant || null;
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
  const shown =
    current ??
    (last
      ? {
          sector: last.sectorName ?? '',
          stand: last.standName ?? '',
          name: rankedName(last.sectorName ?? '', last.standName ?? ''),
          since: null,
          extra: last.weighingType !== 'normal',
        }
      : null);

  return (
    <BentoTile tone="surface" className="justify-start gap-2.5 p-4">
      <div className="flex items-center gap-2">
        {current ? (
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-status-danger-bg px-2.5 t-micro-strong tracking-[0.4px] text-status-danger-fg uppercase">
            <span aria-hidden className="size-1.5 animate-live rounded-full bg-live" />
            {current.extra ? 'Extra-cântar în curs' : 'Cântar în curs'}
          </span>
        ) : (
          <span className="t-label tracking-[0.4px] text-muted uppercase">Ultimul cântar</span>
        )}
        <span className="flex-1" />
        {minutes !== null ? <span className="t-caption text-muted">de {minutes} min</span> : null}
      </div>
      {shown ? (
        <div className="flex items-center gap-2.5">
          <StandBadge sector={shown.sector} stand={shown.stand} />
          <div className="min-w-0 flex-1">
            <p className="truncate t-heading font-extrabold">{shown.name ?? `Stand ${standLabel(shown.sector, shown.stand)}`}</p>
            <p className="truncate t-caption text-muted">
              Sector {shown.sector} · stand {standNumber(shown.sector, shown.stand)}
            </p>
          </div>
        </div>
      ) : loading ? (
        <div role="status" aria-label="Se încarcă cântarele…" className="flex items-center gap-2.5">
          <span aria-hidden className="size-10 shrink-0 animate-shimmer rounded-[12px] bg-soft-fill" />
          <span aria-hidden className="flex flex-1 flex-col gap-2">
            <span className="h-3 w-[70%] rounded-full bg-soft-fill" />
            <span className="h-2.5 w-[45%] rounded-full bg-soft-fill" />
          </span>
        </div>
      ) : (
        <p className="t-body text-muted">Niciun cântar încă.</p>
      )}
      <span className="flex-1" />
      <div className="flex items-center gap-2 border-t border-hairline pt-2.5">
        <p className="min-w-0 flex-1 t-caption text-muted">
          {current && last ? (
            <>
              Anterior:{' '}
              <span className="font-bold text-ink">
                {standLabel(last.sectorName ?? '', last.standName ?? '')} · {formatDecimal(last.totalWeightKg, 2, 3)} kg
              </span>
            </>
          ) : !current && last ? (
            <span className="font-bold text-ink">
              <span className="whitespace-nowrap">{formatDecimal(last.totalWeightKg, 2, 3)} kg</span> ·{' '}
              <span className="whitespace-nowrap">{plural(last.catchCount, 'captură', 'capturi')}</span>
            </span>
          ) : null}
        </p>
        <button type="button" onClick={onAllWeighings} className="shrink-0 t-label text-accent-ink hover:underline">
          Toate cântarele
        </button>
      </div>
    </BentoTile>
  );
}

function allocatedName(a: AllocatedParticipantsResponse[string] | undefined): string | null {
  if (!a) return null;
  return getCompetitorDisplayName({ teamName: a.teamName, participantNames: a.participants.map(p => p.name), guestName: a.guestName, fallback: '' }) || null;
}

/** «A1» in sector A → «1»: the stand without the sector letter its name may repeat. */
function standNumber(sector: string, stand: string): string {
  return sector && stand.length > sector.length && stand.startsWith(sector) ? stand.slice(sector.length) : stand;
}

function StandBadge({ sector, stand }: { sector: string; stand: string }) {
  const fill = sectorFill(sector, 'var(--color-accent)');
  const number = standNumber(sector, stand);
  return (
    <span
      aria-hidden
      className={cn('flex size-10 shrink-0 flex-col items-center justify-center rounded-[12px] text-on-accent', fill.className)}
      style={fill.style}
    >
      <span className="t-micro opacity-85">{sector}</span>
      <span className="t-label font-extrabold">{number}</span>
    </span>
  );
}
