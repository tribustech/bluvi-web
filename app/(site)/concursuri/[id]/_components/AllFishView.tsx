'use client';

import { useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowTrendingDownIcon, ArrowTrendingUpIcon, MapPinIcon, Squares2X2Icon } from '@heroicons/react/20/solid';
import {
  competitionCatchesInfiniteQuery,
  getCompetitorDisplayName,
  type CompetitionCatchesFilter,
  type CompetitionCatchesSort,
  type CompetitionWithMyStatus,
} from '@/core/competitions';
import type { Transport } from '@/core/transport';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingRow } from '@/components/surfaces/StateCard';
import { cn } from '@/components/ui/cn';
import { formatDecimal } from '@/components/cards/format';
import { formatStand, standLabel } from './stand';

/*
 * fish CompetitionRanking `rankingView === 'allFish'`: every catch, sortable (Cei mai mari / mici,
 * Pe stand, Pe sector); stand and sector sorts pick one stand/sector (first one by default) and
 * the API filters. «Încarcă mai mult» pages in.
 */

const SORTS: { value: CompetitionCatchesSort; label: string; Icon: typeof MapPinIcon }[] = [
  { value: 'weight_desc', label: 'Cei mai mari', Icon: ArrowTrendingUpIcon },
  { value: 'weight_asc', label: 'Cei mai mici', Icon: ArrowTrendingDownIcon },
  { value: 'stand', label: 'Pe stand', Icon: MapPinIcon },
  { value: 'sector', label: 'Pe sector', Icon: Squares2X2Icon },
];

export function AllFishView({ t, competition }: { t: Transport; competition: CompetitionWithMyStatus }) {
  const [sort, setSort] = useState<CompetitionCatchesSort>('weight_desc');
  const [picked, setPicked] = useState<string | null>(null);

  // fish catchesFilterOptions: sector names, or every stand of every sector («A7»).
  const options = useMemo(() => {
    if (sort === 'sector') return competition.sectors.map(s => s.name).filter(Boolean);
    if (sort === 'stand') {
      return competition.sectors
        .flatMap(s => s.stands.map(st => formatStand(s.name, st.name)))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }
    return [];
  }, [sort, competition.sectors]);
  // fish auto-selects the first option when the sort needs one.
  const filterValue = sort === 'stand' || sort === 'sector' ? (picked && options.includes(picked) ? picked : (options[0] ?? null)) : null;
  const filter: CompetitionCatchesFilter = !filterValue
    ? null
    : sort === 'sector'
      ? { sectorName: filterValue }
      : { standKey: filterValue };

  const q = useInfiniteQuery(
    competitionCatchesInfiniteQuery(t, competition.documentId, sort, competition.competitionStatus, { filter }),
  );
  const catches = useMemo(() => {
    const seen = new Set<string>();
    return (q.data?.pages.flatMap(p => p.data) ?? []).filter(c => {
      const key = String(c.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [q.data]);

  // fish standIdToDisplayLabel / standIdToParticipantAvatars: the registration on the stand wins.
  const byStand = useMemo(() => {
    const m: Record<string, { label: string; avatar: string | null }> = {};
    for (const reg of competition.registrations) {
      if (reg.registrationStatus !== 'registered' || !reg.stand) continue;
      const label = getCompetitorDisplayName({
        teamName: reg.teamName,
        participantNames: reg.participants.map(p => p.username),
        guestName: reg.guestName,
      });
      const entry = { label, avatar: reg.participants[0]?.avatar?.url ?? null };
      m[String(reg.stand.id)] = entry;
      m[reg.stand.documentId] = entry;
    }
    return m;
  }, [competition.registrations]);

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Sortare capturi" className="-mx-4 flex gap-2 overflow-x-auto px-4 py-0.5 [scrollbar-width:none] md:mx-0 md:px-0">
        {SORTS.map(({ value, label, Icon }) => {
          const selected = sort === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setSort(value);
                setPicked(null);
              }}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full py-1.5 pr-3 pl-1.5 t-caption',
                selected ? 'bg-sector-m text-on-accent' : 'bg-soft-fill text-ink',
              )}
            >
              <span className={cn('flex size-6 items-center justify-center rounded-md', selected ? 'bg-on-accent/25' : 'bg-hairline')}>
                <Icon aria-hidden className="size-3.5" />
              </span>
              {label}
            </button>
          );
        })}
      </div>
      {options.length > 0 ? (
        <div role="group" aria-label={sort === 'sector' ? 'Sector' : 'Stand'} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 py-0.5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
          {options.map(option => {
            const active = option === filterValue;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => setPicked(option)}
                className={cn('shrink-0 rounded-full px-3.5 py-1 t-caption', active ? 'bg-ink-2 text-surface' : 'bg-soft-fill text-ink')}
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : null}

      {q.isPending ? (
        <LoadingRow label="Se încarcă capturile…" />
      ) : q.isError ? (
        <ErrorState
          title="Ceva nu a mers bine, vă rugăm să încercați din nou mai târziu."
          action={
            <Button size="compact" variant="secondary" onClick={() => void q.refetch()}>
              Reîncearcă
            </Button>
          }
        />
      ) : catches.length === 0 ? (
        <EmptyState title="Nu există capturi" />
      ) : (
        <>
          <ul className="overflow-hidden rounded-card bg-surface shadow-e0 md:grid md:grid-cols-2 md:gap-x-6 md:px-2 xl:grid-cols-3">
            {catches.map(c => {
              const key = c.standId != null ? String(c.standId) : '';
              const name =
                byStand[key]?.label ??
                getCompetitorDisplayName({
                  teamName: c.teamName,
                  participantNames: c.participantUsername ? [c.participantUsername] : [],
                  guestName: c.guestName,
                });
              const stand = c.standName ? standLabel(c.sectorName ?? '', c.standName) : (c.sectorName ?? '-');
              return (
                <li key={String(c.id)} className="flex items-center gap-2.5 border-b border-hairline px-4 py-2.5 md:px-2">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-soft-fill t-label text-ink-2">
                    {stand}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-1.5">
                      <span className="t-body tabular-nums">{formatDecimal(c.weight, 1, 3)} kg</span>
                      {c.fishName ? <span className="t-caption text-sector-m">{c.fishName}</span> : null}
                    </span>
                    <span className="block truncate t-caption text-muted">{name}</span>
                  </span>
                  <Avatar name={name !== '-' ? name : '?'} src={byStand[key]?.avatar} size={40} />
                </li>
              );
            })}
          </ul>
          {q.hasNextPage ? (
            <Button variant="secondary" block disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
              {q.isFetchingNextPage ? 'Se încarcă…' : 'Încarcă mai mult'}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
