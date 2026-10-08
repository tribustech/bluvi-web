'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { MagnifyingGlassIcon, Squares2X2Icon } from '@heroicons/react/24/outline';
import type { CompetitionWithMyStatus } from '@/core/competitions';
import { allocatedParticipantsQuery } from '@/core/organizer';
import { formatCount } from '@/core/realtime/chat/format';
import { FlowSearch, FlowToolbar } from '@/components/templates/T6';
import { ButtonLink } from '@/components/ui/Button';
import { routes } from '@/lib/routes';
import type { CompetitionRole } from '../../../_organizer/access';
import { ManagementFrame, useManagementTransport, type ManagementViewer } from '../../../_organizer/ManagementFrame';
import { countStands, filterStandGroups, isNationalChampionship, standOccupantGroups, type StandSectorGroup } from '../../../_organizer/occupant';
import { StandOccupantList } from '../../../_organizer/StandOccupantList';
import { PenaltyStandBodySkeleton } from './PenaltyStandSkeleton';
import { canPickPenaltyStand, penaltyTarget } from './target';

/*
 * «Alege standul» — the penalties' stand picker (parity organizer.penalties-select-stand; fish
 * app/(app)/penalties/[competitionId]/select-stand.tsx). Author or referee only (the frame's gate);
 * signed in only (proxy + requireViewer on the page).
 *  - c1: «Alege standul» + «Alege standul echipei pe care vrei să o sancționezi.»;
 *  - c4: the frame's loader until the competition AND the allocations are in; either failing (or a
 *    missing competition) → the error gate, whose «Încearcă din nou» refetches both;
 *  - c2/c5: «Sector X» in the competition's order (StandOccupantList over occupant.ts), «Stand N»,
 *    the occupant (guest, or participants joined «, »; the team bold first on team competitions);
 *  - c3/c6: unallocated → «Nealocat», dimmed and inert; allocated → the apply form for its
 *    registration (/penalizari/aplica?inscriere=), guarded against a double activation; an
 *    allocation without a registration id keeps its occupant but is drawn inert (dashed, dimmed,
 *    aria-disabled) with «Înscriere indisponibilă» (fish: the press does nothing);
 *  - team: the bold «<echipă>:» only when the allocation has a teamName (fish :84, teamFallback false);
 *  - no stands at all: the author gets «Alocă standuri pe sectoare», a referee is told to ask the
 *    author (web addition; fish renders nothing);
 *  - a competition where no penalty can be applied (ranking type without penalties, or not started)
 *    → back to the penalties hub (consistent with apply c2).
 * Web addition: find-as-you-type over stand / angler / team (a 24-sector field is long).
 */

export function PenaltyStandScreen({ competitionId, viewer }: { competitionId: string; viewer: ManagementViewer }) {
  const t = useManagementTransport();
  const allocations = useQuery(allocatedParticipantsQuery(t, competitionId));
  return (
    <ManagementFrame
      competitionId={competitionId}
      viewer={viewer}
      title="Alege standul"
      titleId="penalizare-stand-titlu"
      requires="authorOrReferee"
      back={{ href: routes.competitionPenalties(competitionId), label: 'Înapoi la penalizări' }}
      reads={[allocations]}
      onRefresh={() => allocations.refetch()}
      skeleton={<PenaltyStandBodySkeleton />}
      hint={({ competition }) =>
        competition && canPickPenaltyStand(competition) ? 'Alege standul echipei pe care vrei să o sancționezi.' : null
      }
    >
      {({ competition, role }) =>
        competition ? (
          canPickPenaltyStand(competition) ? (
            <StandPicker
              competition={competition}
              role={role}
              // fish select-stand.tsx:84: the bold team only when the allocation has a teamName (no «Echipă» invented).
              groups={standOccupantGroups(competition, allocations.data, { teamFallback: false })}
            />
          ) : (
            <BackToHub competitionId={competitionId} />
          )
        ) : null
      }
    </ManagementFrame>
  );
}

/** No penalty can be applied here: replace this page with the hub (no history entry left behind). */
function BackToHub({ competitionId }: { competitionId: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(routes.competitionPenalties(competitionId));
  }, [router, competitionId]);
  return <PenaltyStandBodySkeleton label="Se revine la penalizări…" />;
}

function StandPicker({
  competition,
  role,
  groups,
}: {
  competition: CompetitionWithMyStatus;
  role: CompetitionRole | undefined;
  groups: StandSectorGroup[];
}) {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => filterStandGroups(groups, query), [groups, query]);
  const total = countStands(groups);
  const count = countStands(visible);

  if (total === 0) {
    // The author sets the stands up (organizer.sectors, author only); a referee asks the author.
    const isAuthor = role === 'author';
    return (
      <Note
        icon={<Squares2X2Icon className="size-6" />}
        testId="penalty-stand-empty"
        action={
          isAuthor ? (
            <ButtonLink href={routes.competitionSectors(competition.documentId)} variant="secondary" size="compact">
              Alocă standuri pe sectoare
            </ButtonLink>
          ) : null
        }
      >
        {isAuthor
          ? 'Concursul nu are încă standuri. Adaugă sectoarele și standurile din pagina sectoarelor.'
          : 'Concursul nu are încă standuri. Cere organizatorului să adauge sectoarele și standurile.'}
      </Note>
    );
  }

  return (
    <>
      <FlowToolbar>
        <FlowSearch
          label="Caută stand, pescar sau echipă"
          placeholder="Caută stand, pescar sau echipă"
          value={query}
          onChange={setQuery}
          resultLabel={count === 0 ? 'Niciun stand găsit' : formatCount(count, 'stand găsit', 'standuri găsite')}
        />
      </FlowToolbar>
      {count === 0 ? (
        <Note icon={<MagnifyingGlassIcon className="size-6" />} testId="penalty-stand-no-results">
          Nu există niciun stand sau pescar pentru «{query.trim()}». Verifică ce ai scris sau caută după numărul standului.
        </Note>
      ) : (
        <StandOccupantList
          groups={visible}
          emptyLabel="Nealocat"
          showClub={isNationalChampionship(competition)}
          // Unallocated, or allocated without a registration id (fish: the press does nothing): inert.
          disabledWhen={(stand) => !penaltyTarget(stand)}
          caption={(stand) =>
            stand.allocated && !penaltyTarget(stand) ? <span data-testid="penalty-stand-unavailable">Înscriere indisponibilă</span> : null
          }
          hrefFor={(stand) => {
            const registrationId = penaltyTarget(stand);
            return registrationId ? routes.competitionPenaltiesApply(competition.documentId, registrationId) : null;
          }}
          idPrefix="penalizare-sector"
        />
      )}
    </>
  );
}

/** A line inside the task card with the flow's 40px notice disc (no card in a card). */
function Note({ icon, children, testId, action }: { icon: ReactNode; children: ReactNode; testId: string; action?: ReactNode }) {
  return (
    <div className="flex items-start gap-3" data-testid={testId}>
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-soft-fill text-ink-2">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-3 pt-2">
        <p className="t-body text-ink-2">{children}</p>
        {action}
      </div>
    </div>
  );
}
