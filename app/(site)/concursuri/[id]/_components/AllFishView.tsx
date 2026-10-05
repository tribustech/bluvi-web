'use client';

import { useMemo, useState } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
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
import { EmptyState, ErrorState } from '@/components/surfaces/StateCard';
import { cn } from '@/components/ui/cn';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { ChoiceChips } from '@/components/templates/T1';
import { formatWeight } from '@/components/ranking';
import { isOfflineEmpty, OfflineState } from './offline';
import { StandMark } from './StandMark';
import { PAGE_RETRY } from './retry-policy';
import { formatStand } from './stand';

/** The list card: one column on the phone, two from 768, three from 1280. */
const LIST = 'overflow-hidden rounded-card bg-surface shadow-e0 md:grid md:grid-cols-2 md:gap-x-6 md:px-2 xl:grid-cols-3';
const ROW = 'flex items-center gap-2.5 border-b border-hairline px-4 py-2.5 md:px-2';

/*
 * fish CompetitionRanking `rankingView === 'allFish'`: every catch, sortable (Cei mai mari / mici,
 * Pe stand, Pe sector); stand and sector sorts pick one stand/sector (first one by default) and
 * the API filters. «Încarcă mai mult» pages in.
 */

const SORTS: { value: CompetitionCatchesSort; label: string }[] = [
  { value: 'weight_desc', label: 'Cei mai mari' },
  { value: 'weight_asc', label: 'Cei mai mici' },
  { value: 'stand', label: 'Pe stand' },
  { value: 'sector', label: 'Pe sector' },
];

export function AllFishView({ t, competition }: { t: Transport; competition: CompetitionWithMyStatus }) {
  const [sort, setSort] = useState<CompetitionCatchesSort>('weight_desc');
  const [picked, setPicked] = useState<string | null>(null);
  // Phone: each chip row is one line that scrolls (fish); from 768 the rows wrap.
  const scroll = useBreakpoint() === 'mobile';

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

  // A new sort / filter keeps the rows on screen (dimmed, aria-busy) until its first page lands,
  // so the list never collapses to a loading row and the reader keeps their place.
  const q = useInfiniteQuery({
    ...competitionCatchesInfiniteQuery(t, competition.documentId, sort, competition.competitionStatus, { filter }),
    ...PAGE_RETRY,
    placeholderData: keepPreviousData,
  });
  const swapping = q.isFetching && q.isPlaceholderData;
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
      {/* The kit choice chips (T1), the same pills as the ranking's sector filter. */}
      <ChoiceChips
        name="catches-sort"
        label="Sortare capturi"
        scroll={scroll}
        options={SORTS}
        value={sort}
        onChange={value => {
          setSort(value);
          setPicked(null);
        }}
      />
      {options.length > 0 && filterValue ? (
        <ChoiceChips
          name="catches-filter"
          label={sort === 'sector' ? 'Sector' : 'Stand'}
          scroll={scroll}
          options={options.map(option => ({ value: option, label: option }))}
          value={filterValue}
          onChange={setPicked}
        />
      ) : null}

      {isOfflineEmpty(q) ? (
        <OfflineState onRetry={() => void q.refetch()} />
      ) : q.isPending ? (
        <ListSkeleton />
      ) : q.isError && !q.data ? (
        <ErrorState
          title="Nu s-au putut încărca capturile."
          description="Ceva nu a mers bine, vă rugăm să încercați din nou mai târziu."
          action={
            <Button size="compact" variant="secondary" onClick={() => void q.refetch()}>
              Încearcă din nou
            </Button>
          }
        />
      ) : catches.length === 0 ? (
        <EmptyState title="Nu există capturi" />
      ) : (
        <>
          <ul
            aria-busy={swapping || undefined}
            className={cn(LIST, 'transition-opacity duration-(--duration-fast)', swapping && 'opacity-60')}
          >
            {catches.map(c => {
              const key = c.standId != null ? String(c.standId) : '';
              const name =
                byStand[key]?.label ??
                getCompetitorDisplayName({
                  teamName: c.teamName,
                  participantNames: c.participantUsername ? [c.participantUsername] : [],
                  guestName: c.guestName,
                });
              // The angler leads (the avatar is a person); the stand is the competition's stand mark.
              return (
                <li key={String(c.id)} className={ROW}>
                  <Avatar name={name !== '-' ? name : '?'} src={byStand[key]?.avatar} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-1.5">
                      <span className="t-body-strong tabular-nums">{formatWeight(c.weight)} kg</span>
                      {c.fishName ? <span className="truncate t-caption text-ink-2">{c.fishName}</span> : null}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 t-caption text-muted">
                      {c.standName || c.sectorName ? <StandMark sector={c.sectorName ?? ''} stand={c.standName ?? ''} /> : null}
                      <span className="truncate">{name}</span>
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          {/* A failed next page keeps every catch already loaded (and the reader's place). */}
          {q.isFetchNextPageError ? (
            <ErrorState
              title="Nu am putut încărca mai multe capturi."
              action={
                <Button size="compact" variant="secondary" onClick={() => void q.fetchNextPage()}>
                  Încearcă din nou
                </Button>
              }
            />
          ) : q.hasNextPage ? (
            <Button variant="secondary" block disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
              {q.isFetchingNextPage ? 'Se încarcă…' : 'Încarcă mai mult'}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}

/** The list's shape while its first page loads: the same card, rows (avatar, two lines) and padding. */
function ListSkeleton() {
  return (
    <div role="status" aria-label="Se încarcă capturile…">
      <ul aria-hidden className={LIST}>
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className={ROW}>
            <span className="size-10 shrink-0 animate-shimmer rounded-full" />
            <span className="flex min-w-0 flex-1 flex-col">
              <Bone className="w-24 t-body-strong" />
              <Bone className="w-3/5 t-caption" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A text bone inside a line of the given type step (as tall as the loaded text). */
function Bone({ className }: { className: string }) {
  return (
    <span className={cn('relative block max-w-full', className)}>
      &nbsp;
      <span className="absolute inset-x-0 top-1/2 h-[0.62em] -translate-y-1/2 animate-shimmer rounded-full" />
    </span>
  );
}
