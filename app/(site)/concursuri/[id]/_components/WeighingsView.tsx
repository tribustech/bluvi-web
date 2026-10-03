'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRightIcon, ChevronDownIcon } from '@heroicons/react/20/solid';
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
import { formatDecimal } from '@/components/cards/format';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import { shortDateTime } from './dates';

/*
 * fish CompetitionRanking `rankingView === 'cantare'`: every sector, every stand as a
 * StandCantarCard (who is on it, total kg, Cântare / Extra-Cântare counts), tap to open the
 * stand's weighings (CantarItem). Scale actions (referee/author) are app-only.
 */
export function WeighingsView({
  t,
  competition,
  allocated,
  isAuthenticated,
}: {
  t: Transport;
  competition: CompetitionWithMyStatus;
  allocated: AllocatedParticipantsResponse | undefined;
  isAuthenticated: boolean;
}) {
  const id = competition.documentId;
  // The Public role is not granted the summary (guest → 403): signed out, totals load per stand on open.
  const summaryQ = useQuery(weighingsSummaryQuery(t, id, isAuthenticated));
  const summaryByStand = useMemo(() => {
    const m: Record<string, WeighingsSummaryItem> = {};
    for (const s of summaryQ.data ?? []) m[s.standId] = s;
    return m;
  }, [summaryQ.data]);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!competition.sectors.length) {
    return <p className="px-1 t-body text-muted">Nu există date de afișat</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {competition.sectors.map(sector => {
        const fill = sectorFill(sector.name, 'var(--color-accent)');
        return (
          <section key={sector.documentId} aria-labelledby={`cantar-${sector.documentId}`} className="flex flex-col gap-2">
            <h2 id={`cantar-${sector.documentId}`} className="flex items-center gap-2 t-title1">
              <span aria-hidden className={cn('size-2.5 rounded-full', fill.className)} style={fill.style} />
              Sector {sector.name}
            </h2>
            <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {sector.stands.map(stand => (
                <li key={stand.documentId}>
                  <StandCard
                    t={t}
                    competitionId={id}
                    standId={stand.documentId}
                    standName={stand.name}
                    alloc={allocated?.[stand.documentId] ?? null}
                    summary={summaryByStand[stand.documentId]}
                    summaryLoading={isAuthenticated && summaryQ.isPending}
                    expanded={expanded === stand.documentId}
                    onToggle={() => setExpanded(e => (e === stand.documentId ? null : stand.documentId))}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function StandCard({
  t,
  competitionId,
  standId,
  standName,
  alloc,
  summary,
  summaryLoading,
  expanded,
  onToggle,
}: {
  t: Transport;
  competitionId: string;
  standId: string;
  standName: string;
  alloc: AllocatedParticipantsResponse[string];
  summary: WeighingsSummaryItem | undefined;
  summaryLoading: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const weighingsQ = useQuery(weighingsQuery(t, competitionId, standId, { enabled: expanded && !summaryLoading }));
  const weighings = weighingsQ.data;

  const participants = alloc ? (alloc.guestName ? alloc.guestName : alloc.participants.map(p => p.name).join(', ') || '-') : '-';
  const regular = summary && !expanded ? summary.regularCount : (weighings?.filter(w => w.weighingType === 'normal').length ?? 0);
  const extra = summary && !expanded ? summary.extraCount : (weighings?.filter(w => w.weighingType === 'extra').length ?? 0);
  const fromWeighings = weighings?.length
    ? formatDecimal(weighings.reduce((acc, w) => acc + w.catches.reduce((a, c) => a + c.weight, 0), 0), 3, 3)
    : null;
  const total = summary && !expanded ? `${formatDecimal(Number(summary.totalKg), 3, 3)} kg` : fromWeighings ? `${fromWeighings} kg` : null;

  return (
    <div className="rounded-control bg-accent-tint px-3 py-2.5">
      <button type="button" aria-expanded={expanded} onClick={onToggle} className="flex w-full items-start gap-2 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate t-body-strong">Stand {standName}</span>
          <span className="block truncate t-caption text-muted">
            {alloc ? (
              <>
                {alloc.teamName ? `${alloc.teamName}: ` : ''}
                {participants}
              </>
            ) : (
              '-'
            )}
          </span>
        </span>
        {total ? <span className="shrink-0 t-body-strong text-accent tabular-nums">{total}</span> : null}
        <ChevronDownIcon aria-hidden className={cn('size-5 shrink-0 text-muted transition-transform', expanded && 'rotate-180')} />
      </button>
      {(summaryLoading && !summary) || (expanded && weighingsQ.isPending) ? (
        <p role="status" className="py-1.5 text-center t-caption text-muted">
          Se încarcă…
        </p>
      ) : (
        <>
          <p className="mt-1 flex gap-3 t-caption text-muted">
            <span>
              Cântare: <span className="font-bold text-ink">{regular}</span>
            </span>
            <span>
              Extra-cântare: <span className="font-bold text-ink">{extra}</span>
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
      )}
    </div>
  );
}

/** fish components/scale/CantarItem.tsx (read-only). */
function WeighingItem({ weighing, index }: { weighing: WeighingByStand; index: number }) {
  const total = formatDecimal(weighing.catches.reduce((a, c) => a + c.weight, 0), 3, 3);
  return (
    <li className="flex flex-col gap-1 rounded-control bg-surface p-3 shadow-e0">
      <div className="flex items-center gap-2">
        <span className="flex-1 t-heading">
          Cântar {index + 1} {weighing.weighingType === 'extra' ? '(Extra)' : null}
        </span>
        <Badge color={weighing.weighingStatus === 'finished' ? 'green' : 'yellow'}>
          {weighing.weighingStatus === 'finished' ? 'Terminat' : 'În curs'}
        </Badge>
      </div>
      <p className="flex gap-4 t-body text-muted">
        <span>
          Total: <span className="text-accent tabular-nums">{total} kg</span>
        </span>
        <span>
          Capturi: <span className="text-accent tabular-nums">{weighing.catches.length}</span>
        </span>
      </p>
      {weighing.startDate ? (
        <p className="flex items-center gap-2 t-caption text-muted">
          {shortDateTime(weighing.startDate)}
          <ArrowRightIcon aria-label="până la" className="size-3" />
          {weighing.endDate ? shortDateTime(weighing.endDate) : 'În curs'}
        </p>
      ) : null}
    </li>
  );
}
