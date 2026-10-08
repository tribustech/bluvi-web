'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClockIcon } from '@heroicons/react/24/outline';
import type { CompetitionWithMyStatus } from '@/core/competitions';
import { allocatedParticipantsQuery, weighingByIdQuery, weighingRevisionsQuery, type AllocatedParticipantsResponse } from '@/core/organizer';
import { pluralNoun } from '@/core/realtime/chat/format';
import { FlowAsideCard, FlowSubjectCard } from '@/components/templates/T6';
import { routes } from '@/lib/routes';
import { ManagementFrame, useManagementTransport, type ManagementViewer } from '../../../../../_organizer/ManagementFrame';
import { isNationalChampionship, standOccupantGroups, type StandOccupant } from '../../../../../_organizer/occupant';
import { revisionSessions, revisionTotals, type RevisionSession } from './model';
import { RevisionCard } from './RevisionCard';
import { RevisionsAsideSkeleton, RevisionsBodySkeleton, TITLE, TITLE_ID } from './RevisionsSkeleton';

/*
 * «Istoric modificări» — a weighing's change log (parity organizer.scale-revisions; fish
 * app/(app)/scale/[competitionId]/revisions.tsx). Read-only, signed in (proxy + requireViewer on the
 * page); any signed-in viewer may read it, like fish, so the frame requires `signedIn`.
 *  - c1: the title; loading (the frame's skeleton) and error — «Încearcă din nou» refetches; the log
 *    is always refetched on open (core weighingRevisionsQuery, staleTime 0) — fresh from the CMS; on
 *    staging/prod the edge caches /api/weighing-logs for 30 s (shared with fish, see the M6 CMS note);
 *  - c2: one card per session, «Modificarea {sesiune} [de {utilizator}]»;
 *  - c3/c4: RevisionCard (reopen: «Motiv: …», «Redeschis la …»; close: «Închis la …», «Adăugat:» /
 *    «Șters:» with «• specie X kg»);
 *  - c5: «Nu există modificări pentru acest cântar.»; the header's refresh refetches (fish
 *    pull-to-refresh).
 * ≥1280 (owner rule 14): the rounds run down the centre column as a timeline; the aside holds the
 * stand (fish's dashed subject card: stand, team, anglers) and what the log adds up to. The stand
 * line is also the header's meta line at every width. The allocations only dress the stand card:
 * they never gate the page, and a stand they do not know is not shown (owner rule 4).
 * The stand comes from the URL, the log from the weighing: the stand is shown only once the weighing
 * (core weighingByIdQuery — the scale page's own query, so a client navigation reads it from cache)
 * says it belongs to that stand. A stale or hand-edited link never captions another stand's log.
 */

type Props = { competitionId: string; standId: string; weighingId: string; viewer: ManagementViewer };

export function RevisionsScreen({ competitionId, standId, weighingId, viewer }: Props) {
  const t = useManagementTransport();
  const revisions = useQuery(weighingRevisionsQuery(t, weighingId));
  const allocations = useQuery(allocatedParticipantsQuery(t, competitionId));
  const weighing = useQuery(weighingByIdQuery(t, weighingId));
  const standConfirmed = weighing.isSuccess && weighing.data.stand.documentId === standId;
  const sessions = useMemo(() => revisionSessions(revisions.data), [revisions.data]);

  return (
    <ManagementFrame
      competitionId={competitionId}
      viewer={viewer}
      title={TITLE}
      titleId={TITLE_ID}
      requires="signedIn"
      back={{ href: routes.competitionScaleWeighing(competitionId, standId, weighingId), label: 'Înapoi la cântar' }}
      reads={[revisions]}
      onRefresh={() => Promise.all([revisions.refetch(), allocations.refetch(), weighing.refetch()])}
      skeleton={<RevisionsBodySkeleton />}
      asideSkeleton={<RevisionsAsideSkeleton />}
      hint={({ competition }) => {
        if (!competition || !standConfirmed) return null;
        const stand = findStand(competition, allocations.data, allocations.isSuccess, standId);
        return stand ? <span data-testid="revisions-stand-hint">{standLine(competition, stand)}</span> : null;
      }}
      aside={({ competition }) => {
        const stand = competition && standConfirmed ? findStand(competition, allocations.data, allocations.isSuccess, standId) : null;
        return (
          <>
            {stand && competition ? (
              <FlowSubjectCard
                title={standLine(competition, stand)}
                kicker={stand.club ?? undefined}
                subtitle={stand.team ?? undefined}
                people={allocations.isSuccess && stand.people ? stand.people.split(', ') : undefined}
              />
            ) : null}
            {sessions.length > 0 ? <Summary sessions={sessions} /> : null}
          </>
        );
      }}
    >
      {() => <Timeline sessions={sessions} />}
    </ManagementFrame>
  );
}

/**
 * The stand in the competition's sectors. A national championship's label needs the draw position
 * from the allocations: until they are known it is not shown, rather than swapped later.
 */
function findStand(
  competition: CompetitionWithMyStatus,
  allocations: AllocatedParticipantsResponse | undefined,
  allocationsKnown: boolean,
  standId: string,
): StandOccupant | null {
  if (isNationalChampionship(competition) && !allocationsKnown) return null;
  for (const group of standOccupantGroups(competition, allocationsKnown ? allocations : null)) {
    const stand = group.stands.find((s) => s.standId === standId);
    if (stand) return stand;
  }
  return null;
}

/** fish formatStandLabel: «Sector A, Stand 3»; national championship «Stand A1(10)». */
const standLine = (competition: CompetitionWithMyStatus, stand: StandOccupant) =>
  isNationalChampionship(competition) ? stand.label : `Sector ${stand.sectorName}, ${stand.label}`;

function Timeline({ sessions }: { sessions: RevisionSession[] }) {
  if (sessions.length === 0) {
    return (
      <div className="flex items-start gap-3" data-testid="revisions-empty">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-soft-fill text-ink-2">
          <ClockIcon className="size-6" />
        </span>
        <p className="t-body-strong min-w-0 flex-1 pt-2 text-ink-2">Nu există modificări pentru acest cântar.</p>
      </div>
    );
  }
  return (
    <ol className="flex flex-col gap-4" aria-label="Modificări" data-testid="revisions-list">
      {sessions.map((s, i) => (
        <li key={s.sessionId}>
          <RevisionCard session={s} index={i} />
        </li>
      ))}
    </ol>
  );
}

/** ≥1280: what the log adds up to — rounds, catches added, catches removed (only for a log with rounds). */
function Summary({ sessions }: { sessions: RevisionSession[] }) {
  const totals = revisionTotals(sessions);
  return (
    <FlowAsideCard title="Rezumat" id="modificari-rezumat">
      <p className="flex items-baseline gap-2" data-testid="revisions-count">
        <span className="t-num-40 text-ink tabular-nums">{totals.sessions}</span>
        <span className="t-caption text-muted">{pluralNoun(totals.sessions, 'modificare', 'modificări')}</span>
      </p>
      <dl className="grid grid-cols-2 gap-3 border-t border-hairline pt-3">
        <div className="flex flex-col gap-0.5">
          <dt className="t-caption text-muted">Capturi adăugate</dt>
          <dd className="t-stat text-status-success-fg tabular-nums" data-testid="revisions-added">
            {totals.added}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="t-caption text-muted">Capturi șterse</dt>
          <dd className="t-stat text-status-danger-fg tabular-nums" data-testid="revisions-removed">
            {totals.removed}
          </dd>
        </div>
      </dl>
    </FlowAsideCard>
  );
}
