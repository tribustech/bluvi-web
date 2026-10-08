'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MagnifyingGlassIcon, Squares2X2Icon } from '@heroicons/react/24/outline';
import type { CompetitionWithMyStatus } from '@/core/competitions';
import { allocatedParticipantsQuery } from '@/core/organizer';
import { formatCount } from '@/core/realtime/chat/format';
import { sectorFill } from '@/components/ranking/sector';
import { FlowAsideCard, FlowSearch, FlowToolbar } from '@/components/templates/T6';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { canWeighCompetition, type CompetitionRole } from '../../_organizer/access';
import { ManagementFrame, useManagementTransport, type ManagementViewer } from '../../_organizer/ManagementFrame';
import {
  countStands,
  filterStandGroups,
  isNationalChampionship,
  sectorAnchorId,
  standOccupantGroups,
  type StandSectorGroup,
} from '../../_organizer/occupant';
import { StandOccupantList } from '../../_organizer/StandOccupantList';
import { scaleHint } from './scaleHint';
import { ScaleAsideSkeleton, ScaleBodySkeleton } from './ScaleSkeleton';

/*
 * «Alege standul» — the scale's first step (parity organizer.scale; fish
 * app/(app)/scale/[competitionId]/index.tsx). Signed in only (proxy + requireViewer on the page);
 * any signed-in viewer may read it (fish lets an angler open it read-only), so the frame requires
 * `signedIn` and the statute only decides the tone and the hint.
 *  - c1: «Alege standul»; loading (the frame's skeleton) and error — «Încearcă din nou» refetches
 *    the competition AND the allocations (fish handleRefetch);
 *  - c2: «Sector X» groups in the competition's sector order;
 *  - c3/c4: the stand label (NC: national format + draw position) and the occupant; NC adds the club;
 *  - c5: an unallocated stand is dimmed and inert; an allocated one opens its weighings
 *    (/concursuri/[id]/cantar/[standId], fish history?standId=), guarded against a double tap.
 * Web additions (T6 demo): find-as-you-type over stand / angler / team / club, and from 1280 an aside
 * with the allocation count and a jump list of the sectors (24 sectors × 10 stands is a long page).
 * Reads: competition (shared key with the competition page) + /competitions/:id/allocated-participants.
 */

export function ScaleScreen({ competitionId, viewer }: { competitionId: string; viewer: ManagementViewer }) {
  const t = useManagementTransport();
  const allocations = useQuery(allocatedParticipantsQuery(t, competitionId));
  // The search lives here: the list AND the ≥1280 jump list follow the same filter.
  const [query, setQuery] = useState('');
  return (
    <ManagementFrame
      competitionId={competitionId}
      viewer={viewer}
      title="Alege standul"
      titleId="cantar-titlu"
      requires="signedIn"
      back={{ href: routes.competition(competitionId), label: 'Înapoi la concurs' }}
      reads={[allocations]}
      onRefresh={() => allocations.refetch()}
      skeleton={<ScaleBodySkeleton />}
      asideSkeleton={<ScaleAsideSkeleton />}
      hint={({ competition, role }) => (competition ? scaleHint(competition, role) : null)}
      aside={({ competition }) => {
        if (!competition) return null;
        const groups = standOccupantGroups(competition, allocations.data);
        return <ScaleAside groups={groups} visible={filterStandGroups(groups, query)} filtering={query.trim() !== ''} />;
      }}
    >
      {({ competition, role }) =>
        competition ? (
          <StandPicker
            competition={competition}
            groups={standOccupantGroups(competition, allocations.data)}
            role={role}
            query={query}
            onQueryChange={setQuery}
          />
        ) : null
      }
    </ManagementFrame>
  );
}

function StandPicker({
  competition,
  groups,
  role,
  query,
  onQueryChange,
}: {
  competition: CompetitionWithMyStatus;
  groups: StandSectorGroup[];
  role: CompetitionRole | undefined;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const visible = useMemo(() => filterStandGroups(groups, query), [groups, query]);
  const total = countStands(groups);
  const count = countStands(visible);
  const isNc = isNationalChampionship(competition);

  if (total === 0) {
    return (
      <Note icon={<Squares2X2Icon className="size-6" />} testId="scale-empty">
        Concursul nu are încă standuri pe sectoare. Standurile apar aici după ce organizatorul le alocă pe sectoare.
      </Note>
    );
  }

  return (
    <>
      <FlowToolbar>
        <FlowSearch
          label="Caută stand, pescar, echipă sau club"
          placeholder="Caută stand, pescar sau club"
          value={query}
          onChange={onQueryChange}
          resultLabel={count === 0 ? 'Niciun stand găsit' : formatCount(count, 'stand găsit', 'standuri găsite')}
        />
      </FlowToolbar>
      {count === 0 ? (
        <Note icon={<MagnifyingGlassIcon className="size-6" />} testId="scale-no-results">
          Nu există niciun stand sau pescar pentru «{query.trim()}». Verifică ce ai scris sau caută după numărul standului.
        </Note>
      ) : (
        <StandOccupantList
          groups={visible}
          emptyLabel="-"
          showClub={isNc}
          tone={canWeighCompetition(role, competition) ? 'accent' : 'neutral'}
          hrefFor={(stand) => routes.competitionScaleStand(competition.documentId, stand.standId)}
          idPrefix="cantar-sector"
        />
      )}
    </>
  );
}

/** A line inside the task card with the flow's 40px notice disc (no card in a card). */
function Note({ icon, children, testId }: { icon: ReactNode; children: ReactNode; testId: string }) {
  return (
    <div className="flex items-start gap-3" data-testid={testId}>
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-soft-fill text-ink-2">
        {icon}
      </span>
      <p className="t-body min-w-0 flex-1 pt-2 text-ink-2">{children}</p>
    </div>
  );
}

/**
 * ≥1280: how much of the field is seated, and the sectors as a jump list (each with its colour and
 * «alocate / standuri»). Hidden below 1280: the phone scrolls one list.
 * While a search is active the card says so («K găsite») and each sector shows its matches; a sector
 * with none is dimmed and inert (its heading is not on the page, so a link would go nowhere).
 */
function ScaleAside({ groups, visible, filtering }: { groups: StandSectorGroup[]; visible: StandSectorGroup[]; filtering: boolean }) {
  const total = countStands(groups);
  if (total === 0) return null;
  const allocated = groups.reduce((n, g) => n + g.allocated, 0);
  const matches = new Map(visible.map((g) => [g.sectorId, g.stands.length]));
  const found = countStands(visible);
  return (
    <FlowAsideCard title="Standuri" id="cantar-rezumat">
      <div className="flex flex-col">
        <p className="flex items-baseline gap-2" data-testid="scale-allocated-count">
          <span className="t-num-40 text-ink tabular-nums">{allocated}</span>
          <span className="t-caption text-muted">din {formatCount(total, 'stand alocat', 'standuri alocate')}</span>
        </p>
        {filtering ? (
          <p className="t-caption text-accent-ink" data-testid="scale-filter-count">
            Căutare: {found === 0 ? 'niciun stand găsit' : formatCount(found, 'stand găsit', 'standuri găsite')}
          </p>
        ) : null}
      </div>
      <nav aria-label="Sectoare" className="border-t border-hairline pt-3">
        {/* Many sectors (up to 24): two columns, so the whole jump list fits beside the grid. */}
        <ul className={cn('flex flex-col', groups.length > 8 && 'grid grid-cols-2 gap-x-4')}>
          {groups.map((g) => {
            const fill = sectorFill(g.paletteLetter ?? '', g.color);
            const hits = matches.get(g.sectorId) ?? 0;
            const dim = filtering && hits === 0;
            const row = (
              <>
                <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', dim && 'opacity-40', fill.className)} style={fill.style} />
                <span className={cn('t-body', dim ? 'text-muted' : 'text-ink')}>Sector {g.name}</span>
                <span className="t-caption ml-auto text-muted tabular-nums">
                  {filtering ? (
                    <>
                      {hits}/{g.stands.length}
                      <span className="sr-only"> {hits === 1 ? 'stand găsit' : 'standuri găsite'}</span>
                    </>
                  ) : (
                    <>
                      {g.allocated}/{g.stands.length}
                      <span className="sr-only"> standuri alocate</span>
                    </>
                  )}
                </span>
              </>
            );
            return (
              <li key={g.sectorId}>
                {dim ? (
                  <span aria-disabled="true" data-testid={`scale-jump-${g.name}`} className="-mx-2 flex min-h-10 items-center gap-2 px-2">
                    {row}
                  </span>
                ) : (
                  <a
                    href={`#${sectorAnchorId('cantar-sector', g.name)}`}
                    data-testid={`scale-jump-${g.name}`}
                    className="-mx-2 flex min-h-10 items-center gap-2 rounded-control px-2 hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {row}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </FlowAsideCard>
  );
}
