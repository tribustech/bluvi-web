'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import {
  competitionCatchesInfiniteQuery,
  getCompetitorDisplayName,
  type CompetitionCatchesFilter,
  type CompetitionCatchesSort,
  type CompetitionWithMyStatus,
} from '@/core/competitions';
import type { Transport } from '@/core/transport';
import { Avatar, FaceStack } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/surfaces/StateCard';
import { cn } from '@/components/ui/cn';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { ChoiceChips } from '@/components/templates/T1';
import { isOfflineEmpty, OfflineState } from './offline';
import { QueryRetry } from './QueryRetry';
import { formatKg } from './ranking';
import { PAGE_RETRY } from './retry-policy';
import { StandMark } from './StandMark';
import { formatStand, standLabel } from './stand';

/**
 * The list card: one shrinkable column on the phone (a long name truncates, never widens the row),
 * then as many ~320px columns as fit (auto-fill: two at 768, three and more on the wide screens).
 * Every row draws its hairline on top and the list is pulled up 1px inside the clipping card, so
 * the first row's lines vanish and a part-filled last row leaves no orphan hairlines under empty
 * columns. The columns are rows of one list, so they sit a wider channel apart than the T1 cards.
 */
const CARD = 'overflow-hidden rounded-card bg-surface shadow-e0';
const LIST = '-mt-px grid grid-cols-[minmax(0,1fr)] md:grid-cols-[repeat(auto-fill,minmax(--spacing(80),1fr))] md:gap-x-6 md:px-2';
const ROW = 'flex min-w-0 items-center gap-2.5 border-t border-hairline px-4 py-2.5 md:px-2';

/*
 * fish CompetitionRanking `rankingView === 'allFish'`: every catch, sortable (Cei mai mari / mici,
 * Pe stand, Pe sector); stand and sector sorts pick one stand/sector (first one by default) and
 * the API filters. 20 per page: the next page loads by itself within 200 px of the end, and
 * «Încarcă mai mult» stays as the explicit (keyboard) way while more pages exist (parity
 * competition-page.toti-pestii). Each row: the stand badge, the weight and species, the competitor,
 * the stand's faces (6, then «+n»).
 */

/** fish AVATAR stack: six faces, then «+n». */
const MAX_FACES = 6;
/** fish handleLoadMore: within this much of the end the next page loads. */
const LOAD_AHEAD_PX = 200;

const SORTS: { value: CompetitionCatchesSort; label: string }[] = [
  { value: 'weight_desc', label: 'Cei mai mari' },
  { value: 'weight_asc', label: 'Cei mai mici' },
  { value: 'stand', label: 'Pe stand' },
  { value: 'sector', label: 'Pe sector' },
];

export function AllFishView({
  t,
  competition,
  decimals,
}: {
  t: Transport;
  competition: CompetitionWithMyStatus;
  /** The competition's weight precision (weightDecimals): the same as the summary tiles above. */
  decimals: number;
}) {
  const [sort, setSort] = useState<CompetitionCatchesSort>('weight_desc');
  const [picked, setPicked] = useState<string | null>(null);
  // Phone: each chip row is one line that scrolls (fish); from 768 the rows wrap.
  const scroll = useBreakpoint() === 'mobile';

  // The pages already read (any sort / filter): fish falls back to them for the chips when the
  // competition carries no sectors / stands.
  const [seen, setSeen] = useState<{ sectorName: string | null; standName: string }[]>([]);
  // fish catchesFilterOptions: sector names, or every stand of every sector in natural order. A
  // stand's value is the CMS `standKey` (fish formatStand: sector letter + stand name, «AA1» when
  // the stand is named «A1»); its chip reads as the rows' stand mark («A1», standLabel), so the
  // chips and the list never name one stand two ways.
  const options = useMemo((): { value: string; label: string }[] => {
    if (sort === 'sector') {
      const names = competition.sectors.map(s => s.name).filter(Boolean);
      const list = names.length
        ? names
        : [...new Set(seen.map(c => c.sectorName).filter((n): n is string => !!n))].sort((a, b) => a.localeCompare(b));
      return list.map(name => ({ value: name, label: name }));
    }
    if (sort === 'stand') {
      const pairs = competition.sectors.flatMap(s => s.stands.map(st => ({ sector: s.name, stand: st.name })));
      const list = pairs.length
        ? pairs
        : seen.filter(c => c.standName !== '').map(c => ({ sector: c.sectorName ?? '', stand: c.standName }));
      const byKey = new Map<string, string>();
      for (const { sector, stand } of list) {
        const key = formatStand(sector, stand);
        if (!byKey.has(key)) byKey.set(key, standLabel(sector, stand));
      }
      return [...byKey.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
    }
    return [];
  }, [sort, competition.sectors, seen]);
  // fish auto-selects the first option when the sort needs one.
  const filterValue =
    sort === 'stand' || sort === 'sector'
      ? picked && options.some(o => o.value === picked)
        ? picked
        : (options[0]?.value ?? null)
      : null;
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
  // Remember the unfiltered pages (a render-time update, guarded by the data it came from).
  const [seenFrom, setSeenFrom] = useState<unknown>(null);
  if (q.data && q.data !== seenFrom && (sort === 'weight_desc' || sort === 'weight_asc')) {
    setSeenFrom(q.data);
    const rows = q.data.pages.flatMap(p => p.data);
    if (rows.length) setSeen(rows.map(c => ({ sectorName: c.sectorName, standName: c.standName })));
  }
  const catches = useMemo(() => {
    const seen = new Set<string>();
    return (q.data?.pages.flatMap(p => p.data) ?? []).filter(c => {
      const key = String(c.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [q.data]);

  // fish standIdToDisplayLabel / standIdToParticipantAvatars: the registration on the stand wins;
  // its faces are its members (a guest-only registration: the guest's initial).
  const byStand = useMemo(() => {
    const m: Record<string, { label: string; faces: { name: string; src: string | null }[] }> = {};
    for (const reg of competition.registrations) {
      if (reg.registrationStatus !== 'registered' || !reg.stand) continue;
      const label = getCompetitorDisplayName({
        teamName: reg.teamName,
        participantNames: reg.participants.map(p => p.username),
        guestName: reg.guestName,
      });
      const faces = reg.participants.length
        ? reg.participants.map(p => ({
            name: p.username || '?',
            src: p.avatar?.url ?? null,
          }))
        : reg.guestName
          ? [{ name: reg.guestName, src: null }]
          : [];
      const entry = { label, faces };
      m[String(reg.stand.id)] = entry;
      m[reg.stand.documentId] = entry;
    }
    return m;
  }, [competition.registrations]);

  // fish onEndReached (threshold 200 px): the next page loads as the end comes near.
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = q;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage || isFetchingNextPage || isFetchNextPageError) return;
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) void fetchNextPage();
      },
      { rootMargin: `0px 0px ${LOAD_AHEAD_PX}px 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, catches.length]);

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
          options={options}
          value={filterValue}
          onChange={setPicked}
        />
      ) : null}

      {isOfflineEmpty(q) ? (
        <OfflineState fetching={q.isFetching} onRetry={() => void q.refetch()} />
      ) : q.isPending ? (
        <ListSkeleton />
      ) : q.isError && !q.data ? (
        <ErrorState
          title="Nu s-au putut încărca capturile."
          description="Ceva nu a mers bine, vă rugăm să încercați din nou mai târziu."
          action={<QueryRetry fetching={q.isFetching} failed onRetry={() => void q.refetch()} size="compact" />}
        />
      ) : catches.length === 0 ? (
        <EmptyState title="Nu există capturi" />
      ) : (
        <>
          <div className={CARD}>
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
              const faces = byStand[key]?.faces ?? [];
              return (
                <li key={String(c.id)} className={ROW}>
                  {/* fish: «A12» (or the sector, or «-»): the page's one stand mark (dot + label), so the
                      faces on the right stay the row's only round element. */}
                  <span className="min-w-12 shrink-0">
                    {c.standName ? (
                      <StandMark sector={c.sectorName ?? ''} stand={c.standName} />
                    ) : (
                      <span className="t-label text-muted">
                        {c.sectorName ? <span className="sr-only">Sector </span> : null}
                        {c.sectorName ?? '-'}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-1.5">
                      <span className="t-body-strong tabular-nums">{formatKg(c.weight, decimals)} kg</span>
                      {c.fishName ? <span className="truncate t-caption text-ink-2">{c.fishName}</span> : null}
                    </span>
                    <span className="block truncate t-caption text-muted">{name}</span>
                  </span>
                  {faces.length ? (
                    <FaceStack
                      people={faces.slice(0, MAX_FACES)}
                      overflow={Math.max(0, faces.length - MAX_FACES)}
                      size={32}
                      className="shrink-0"
                    />
                  ) : (
                    <Avatar name={name !== '-' ? name : '?'} size={32} className="shrink-0" />
                  )}
                </li>
              );
            })}
          </ul>
          </div>
          {/* A failed next page keeps every catch already loaded (and the reader's place). */}
          {q.isFetchNextPageError ? (
            <ErrorState
              title="Nu am putut încărca mai multe capturi."
              action={
                <QueryRetry fetching={q.isFetchingNextPage} failed onRetry={() => void q.fetchNextPage()} size="compact" />
              }
            />
          ) : q.hasNextPage ? (
            <>
              <div ref={sentinel} aria-hidden />
              <Button
                variant="secondary"
                // A phone-width CTA below 768; from there a centred button, not a 1400px bar.
                className="max-md:w-full md:self-center"
                aria-busy={q.isFetchingNextPage || undefined}
                aria-disabled={q.isFetchingNextPage || undefined}
                onClick={() => {
                  if (!q.isFetchingNextPage) void q.fetchNextPage();
                }}
              >
                {q.isFetchingNextPage ? 'Se încarcă…' : 'Încarcă mai mult'}
              </Button>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

/** The list's shape while its first page loads: the same card, rows (avatar, two lines) and padding. */
function ListSkeleton() {
  return (
    <div role="status" aria-label="Se încarcă capturile…" className={CARD}>
      <ul aria-hidden className={LIST}>
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className={ROW}>
            <Bone className="w-12 shrink-0 t-label" />
            <span className="flex min-w-0 flex-1 flex-col">
              <Bone className="w-24 t-body-strong" />
              <Bone className="w-3/5 t-caption" />
            </span>
            <span className="size-8 shrink-0 animate-shimmer rounded-full" />
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
