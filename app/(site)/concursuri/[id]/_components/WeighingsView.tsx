'use client';

import { useMemo, useState } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import type { CompetitionWithMyStatus } from '@/core/competitions';
import {
  weighingsQuery,
  weighingsSummaryQuery,
  type AllocatedParticipantsResponse,
  type WeighingByStand,
  type WeighingsSummaryItem,
} from '@/core/organizer';
import type { Transport } from '@/core/transport';
import { sectorFill } from '@/components/ranking/sector';
import { formatWeight } from '@/components/ranking';
import { EmptyState, ErrorState } from '@/components/surfaces/StateCard';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { StatusPill } from '@/components/ui/StatusPill';
import { shortDateTime } from './dates';
import { StandMark } from './StandMark';
import { isOfflineEmpty, OfflineState } from './offline';
import { PAGE_RETRY } from './retry-policy';

/*
 * fish CompetitionRanking `rankingView === 'cantare'`: every sector, every stand as a
 * StandCantarCard (who is on it, total kg, Cântare / Extra-Cântare counts), tap to open the
 * stand's weighings (CantarItem). Scale actions (referee/author) are app-only.
 *
 * Numbers are shown only when they are known: signed out the summary is not granted, so a closed
 * stand says «Deschide standul pentru cântare» rather than a made-up «0»; a failed (or offline) read
 * is an error with a retry, never zeros. While the allocation loads, each sector is its bones only.
 *
 * Each stand is a surface card (radius card, e0), like every sibling view's cards, on an
 * auto-fill grid: more stands per row as the screen grows, never wider cards.
 */

const STAND_GRID = 'grid items-start gap-3 md:grid-cols-[repeat(auto-fill,minmax(--spacing(80),1fr))]';
const STAND_CARD = 'rounded-card bg-surface p-4 shadow-e0';
export function WeighingsView({
  t,
  competition,
  allocated,
  isAuthenticated,
}: {
  t: Transport;
  competition: CompetitionWithMyStatus;
  allocated: UseQueryResult<AllocatedParticipantsResponse>;
  isAuthenticated: boolean;
}) {
  const id = competition.documentId;
  // The Public role is not granted the summary (guest → 403): signed out, totals load per stand on open.
  const summaryQ = useQuery({ ...weighingsSummaryQuery(t, id, isAuthenticated), ...PAGE_RETRY });
  const summaryByStand = useMemo(() => {
    const m: Record<string, WeighingsSummaryItem> = {};
    for (const s of summaryQ.data ?? []) m[s.standId] = s;
    return m;
  }, [summaryQ.data]);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!competition.sectors.length) {
    return <EmptyState title="Nu există date de afișat" />;
  }

  const summaryOffline = isAuthenticated && isOfflineEmpty(summaryQ);
  const summaryFailed = isAuthenticated && ((summaryQ.isError && !summaryQ.data) || summaryOffline);
  const allocationFailed = allocated.isError && !allocated.data;
  const allocationLoading = allocated.isPending;

  // Without the allocation every stand would read as empty («-»): only the state, with its retry.
  if (isOfflineEmpty(allocated)) {
    return <OfflineState onRetry={() => void allocated.refetch()} />;
  }
  if (allocationFailed) {
    return (
      <ErrorState
        title="Nu s-au putut încărca participanții."
        action={
          <Button size="compact" variant="secondary" onClick={() => void allocated.refetch()}>
            Încearcă din nou
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {summaryOffline ? (
        <OfflineState onRetry={() => void summaryQ.refetch()} />
      ) : summaryFailed ? (
        <ErrorState
          title="Nu s-au putut încărca totalurile cântarelor."
          action={
            <Button size="compact" variant="secondary" onClick={() => void summaryQ.refetch()}>
              Încearcă din nou
            </Button>
          }
        />
      ) : null}
      {competition.sectors.map(sector => {
        const fill = sectorFill(sector.name, 'var(--color-accent)');
        return (
          <section key={sector.documentId} aria-labelledby={`cantar-${sector.documentId}`} className="flex flex-col gap-2">
            <h2 id={`cantar-${sector.documentId}`} className="flex items-center gap-2 t-title2">
              <span aria-hidden className={cn('size-2.5 rounded-full', fill.className)} style={fill.style} />
              Sector {sector.name}
            </h2>
            {allocationLoading ? (
              // The sector's stands in grey (no hint, no counts): announced once for the view.
              <ul aria-hidden className={STAND_GRID}>
                {sector.stands.map(stand => (
                  <li key={stand.documentId} className={cn(STAND_CARD, 'flex items-start gap-2')}>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <Bone className="w-12 t-body-strong" />
                      <Bone className="w-3/5 t-caption" />
                    </span>
                    <Bone className="w-16 t-body-strong" />
                  </li>
                ))}
              </ul>
            ) : (
            <ul className={STAND_GRID}>
              {sector.stands.map(stand => (
                <li key={stand.documentId}>
                  <StandCard
                    t={t}
                    competitionId={id}
                    standId={stand.documentId}
                    sectorName={sector.name}
                    standName={stand.name}
                    alloc={allocated.data?.[stand.documentId] ?? null}
                    signedIn={isAuthenticated}
                    summary={summaryByStand[stand.documentId]}
                    summaryLoading={isAuthenticated && summaryQ.isPending && summaryQ.fetchStatus === 'fetching'}
                    summaryFailed={summaryFailed}
                    expanded={expanded === stand.documentId}
                    onToggle={() => setExpanded(e => (e === stand.documentId ? null : stand.documentId))}
                  />
                </li>
              ))}
            </ul>
            )}
          </section>
        );
      })}
      {allocationLoading ? (
        <p role="status" className="sr-only">
          Se încarcă standurile…
        </p>
      ) : null}
    </div>
  );
}

/** A text bone inside a line of the given type step (as tall as the loaded text). */
function Bone({ className }: { className: string }) {
  return (
    <span aria-hidden className={cn('relative block max-w-full', className)}>
      &nbsp;
      <span className="absolute inset-x-0 top-1/2 h-[0.62em] -translate-y-1/2 animate-shimmer rounded-full" />
    </span>
  );
}

function StandCard({
  t,
  competitionId,
  standId,
  sectorName,
  standName,
  alloc,
  signedIn,
  summary,
  summaryLoading,
  summaryFailed,
  expanded,
  onToggle,
}: {
  t: Transport;
  competitionId: string;
  standId: string;
  sectorName: string;
  standName: string;
  alloc: AllocatedParticipantsResponse[string];
  /** Signed out the totals are not readable until the stand is opened (the «Deschide standul» hint). */
  signedIn: boolean;
  summary: WeighingsSummaryItem | undefined;
  summaryLoading: boolean;
  /** The totals read failed (said once, above the sectors): a closed stand shows no counts line. */
  summaryFailed: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const weighingsQ = useQuery({ ...weighingsQuery(t, competitionId, standId, { enabled: expanded && !summaryLoading }), ...PAGE_RETRY });
  const weighings = weighingsQ.data;

  const participants = alloc ? (alloc.guestName ? alloc.guestName : alloc.participants.map(p => p.name).join(', ') || '-') : '-';
  // The open stand counts its own weighings; a closed one shows the summary when there is one.
  const fromList = expanded && weighingsQ.isSuccess && weighings;
  const counts = fromList
    ? {
        regular: weighings.filter(w => w.weighingType === 'normal').length,
        extra: weighings.filter(w => w.weighingType === 'extra').length,
        kg: weighings.length ? weighings.reduce((acc, w) => acc + w.catches.reduce((a, c) => a + c.weight, 0), 0) : null,
      }
    : summary
      ? { regular: summary.regularCount, extra: summary.extraCount, kg: Number(summary.totalKg) }
      : null;
  const loadingCounts = (summaryLoading && !summary) || (expanded && weighingsQ.isPending);
  const failed = expanded && weighingsQ.isError && !weighings;

  return (
    <div className={STAND_CARD}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-start gap-2 rounded-control text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate">
            <StandMark sector={sectorName} stand={standName} className="t-body-strong" />
          </span>
          <span className="block truncate t-caption text-muted">
            {alloc ? (
              <>
                {alloc.teamName ? `${alloc.teamName}: ` : ''}
                {participants}
              </>
            ) : (
              // fish: «-» for a stand the allocation says is empty (a failed read never reaches here).
              '–'
            )}
          </span>
        </span>
        {counts && counts.kg !== null ? (
          <span className="shrink-0 t-body-strong text-accent-ink tabular-nums">{formatWeight(counts.kg)} kg</span>
        ) : null}
        <ChevronDownIcon aria-hidden className={cn('size-6 shrink-0 text-muted transition-transform duration-(--duration-fast)', expanded && 'rotate-180')} />
      </button>
      {loadingCounts ? (
        <span role="status" aria-label="Se încarcă cântarele standului" className="mt-1.5 flex gap-3">
          <span aria-hidden className="h-3 w-20 animate-shimmer rounded-full" />
          <span aria-hidden className="h-3 w-24 animate-shimmer rounded-full" />
        </span>
      ) : failed ? (
        <ErrorState
          className="mt-2"
          title="Cântarele standului nu au putut fi încărcate."
          action={
            <Button size="compact" variant="secondary" onClick={() => void weighingsQ.refetch()}>
              Încearcă din nou
            </Button>
          }
        />
      ) : counts ? (
        <>
          <p className="mt-1 flex gap-3 t-caption text-muted">
            <span>
              Cântare: <span className="t-label text-ink">{counts.regular}</span>
            </span>
            <span>
              Extra-cântare: <span className="t-label text-ink">{counts.extra}</span>
            </span>
          </p>
          {expanded && weighings && weighings.length > 0 ? (
            <ol className="mt-2 flex flex-col gap-2 border-t border-hairline pt-2">
              {weighings.map((w, i) => (
                <WeighingItem key={w.documentId} weighing={w} index={i} />
              ))}
            </ol>
          ) : null}
        </>
      ) : summaryFailed || signedIn ? null : (
        // Signed out and closed: the counts are only read when the stand is opened.
        <p className="mt-1 t-caption text-muted">Deschide standul pentru cântare</p>
      )}
    </div>
  );
}

/** fish components/scale/CantarItem.tsx (read-only). */
function WeighingItem({ weighing, index }: { weighing: WeighingByStand; index: number }) {
  const total = formatWeight(weighing.catches.reduce((a, c) => a + c.weight, 0));
  const finished = weighing.weighingStatus === 'finished';
  return (
    <li className="flex flex-col gap-1 rounded-control bg-page p-3">
      <div className="flex items-center gap-2">
        <span className="flex-1 t-heading">
          Cântar {index + 1} {weighing.weighingType === 'extra' ? '(Extra)' : null}
        </span>
        {/* A state, not an attribute: the status pill (radius 999). */}
        <StatusPill tone={finished ? 'success' : 'live'}>{finished ? 'Terminat' : 'În curs'}</StatusPill>
      </div>
      <p className="flex gap-4 t-body text-muted">
        <span>
          Total: <span className="text-accent-ink tabular-nums">{total} kg</span>
        </span>
        <span>
          Capturi: <span className="text-accent-ink tabular-nums">{weighing.catches.length}</span>
        </span>
      </p>
      {weighing.startDate ? (
        <p className="t-caption text-muted">
          {shortDateTime(weighing.startDate)} <span aria-hidden>–</span>
          <span className="sr-only">până la</span> {weighing.endDate ? shortDateTime(weighing.endDate) : 'în curs'}
        </p>
      ) : null}
    </li>
  );
}
