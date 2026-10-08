'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LockClosedIcon, Squares2X2Icon } from '@heroicons/react/24/outline';
import {
  competitionQuery,
  competitionRegistrationsListQuery,
  competitionsKeys,
  previousLegSeats,
  rankingsQuery,
  type CompetitionWithMyStatus,
  type FeederRoundsRanking,
} from '@/core/competitions';
import {
  allocatedParticipantsQuery,
  allocateFeederRoundMutation,
  allocateStandToRegistrationMutation,
  competitionManagementKeys,
  type AllocatedParticipantsResponse,
} from '@/core/organizer';
import { formatCount } from '@/core/realtime/chat/format';
import { useLeaveGuard } from '@/components/account/profile-form/useLeaveGuard';
import { sectorFill } from '@/components/ranking/sector';
import { T4Gate, T4Spinner } from '@/components/templates/T4';
import { FlowActions, FlowAsideCard, FlowAsideSkeleton } from '@/components/templates/T6';
import { Button, ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { useSiteToast } from '../../../../_shell/Toast';
import { ManagementFrame, useManagementTransport, type ManagementViewer } from '../../_organizer/ManagementFrame';
import { AllocationBodySkeleton } from './AllocationSkeleton';
import { ROW_LIST, SECTOR_CARD, SECTOR_COLUMNS } from './layout';
import {
  ALLOCATION_TITLE_ID,
  allocationBlock,
  allocationsBody,
  allocationTitle,
  applySeatEdits,
  initialSeats,
  isDirty,
  legIntro,
  legSavedMessage,
  NO_CHANGES,
  occupantOf,
  orderedSectors,
  registrationOptions,
  SAVED_MESSAGE,
  saveErrorMessage,
  seatCounts,
  sectorPalette,
  unseated,
  withSeatEdit,
  type Seats,
  type SeatEdits,
} from './model';
import { RegistrationPicker } from './RegistrationPicker';
import { StandRow } from './StandRow';

/*
 * «Alocare participanți» / «Standuri manșa N» (parity organizer.participants c1–c9; fish
 * app/(app)/configure/participants/[competitionId].tsx). The competition's author only (fish reaches
 * it from the author's menu and the feeder leg action «Reașază pentru manșa N»; the frame's `author`
 * gate shows a neutral page to anyone else).
 * - c1: the frame waits for the competition AND the allocations (AllocationBodySkeleton); an error
 *   gate's «Încearcă din nou» refetches the competition (frame), the allocations and the
 *   registrations list (onRefresh) — fish handleRefetch;
 * - c2/c3: the title from ?mansa=N (N > 1 = leg seating) and, in leg seating, the draw intro;
 * - c4–c6: per sector the stand rows (StandRow), prefilled from the allocations outside leg seating;
 *   a row opens the RegistrationPicker, its trash empties it;
 * - c7: the picker's options (model registrationOptions; in leg seating with the previous leg's seat
 *   from the feeder ranking, fish previousLegSeats);
 * - c8: «Finalizează alocarea» PUTs { allocations: { registrationId: standId } } (core
 *   allocateStandToRegistrationMutation), toasts and goes back to the competition (the entry
 *   replaced, as fish router.back()); an error toasts the server's message and keeps the edits;
 *   either way the competition, the allocations and the registrations are refetched;
 * - c9: leg seating «Salvează standurile (x/y)», off until every registered entrant has a stand, PUTs
 *   rounds/:round/allocation (core allocateFeederRoundMutation, which also refreshes the leg state).
 * - Web additions, so no request reaches the CMS that it refuses or that only re-notifies everyone
 *   (an allocation with every entrant seated pushes COMPETITION_PARTICIPANTS_ALLOCATION to every
 *   participant, referee and follower, changes or not): «Finalizează alocarea» is off with «Nicio
 *   modificare de salvat.» until something changed; a started / ended competition (normal
 *   allocation) and a leg the leg actions do not offer to re-seat (?mansa=N) show a neutral gate
 *   instead of the editor (model allocationBlock).
 * - Sectors and stands in natural order by name (model orderedSectors), as the competition page.
 * Unsaved edits are never dropped silently: the site's leave dialog («Renunți la modificări?») holds
 * the back link, in-app links, browser Back and unload (web addition).
 */

type Picking = { standId: string; standName: string; sectorName: string };

export function AllocationScreen({
  competitionId,
  viewer,
  legRound,
}: {
  competitionId: string;
  viewer: ManagementViewer;
  legRound: number | null;
}) {
  const t = useManagementTransport();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useSiteToast();
  // The frame reads the same key: one request, shared.
  const competition = useQuery(competitionQuery(t, competitionId, { isAuthenticated: true }));
  const allocations = useQuery(allocatedParticipantsQuery(t, competitionId));
  // fish mounts the registrations list only to refetch it after a save (other screens read it).
  const registrations = useQuery(competitionRegistrationsListQuery(t, competitionId));
  // fish useRankings(id, isLegSeating ? 'started' : 'notStarted'): read only while re-seating a leg.
  const rankings = useQuery(rankingsQuery(t, competitionId, legRound ? 'started' : 'notStarted'));

  const [edits, setEdits] = useState<SeatEdits>({});
  const [picking, setPicking] = useState<Picking | null>(null);
  const [saved, setSaved] = useState(false);
  const allocate = useMutation(allocateStandToRegistrationMutation(t));
  const allocateLeg = useMutation(allocateFeederRoundMutation(t, qc));
  const saving = allocate.isPending || allocateLeg.isPending;

  const data = competition.data;
  const initial = useMemo(
    () => (data && allocations.data ? initialSeats(data, allocations.data, legRound) : null),
    [data, allocations.data, legRound],
  );
  const seats = useMemo(() => (initial ? applySeatEdits(initial, edits) : null), [initial, edits]);
  const dirty = Boolean(initial && seats && isDirty(initial, seats));
  const { dialog: leaveDialog } = useLeaveGuard(dirty && !saved);

  const previous = useMemo(() => {
    const r = rankings.data;
    // The response is a union keyed on metadata.rankingType, which TS does not narrow through: fish casts too.
    return legRound && r?.metadata.rankingType === 'feederRounds' ? previousLegSeats(r.rankings as FeederRoundsRanking[], legRound) : {};
  }, [rankings.data, legRound]);

  const options = useMemo(
    () => (data && seats ? registrationOptions(data, seats, picking?.standId ?? null, previous) : []),
    [data, seats, picking, previous],
  );

  const back = routes.competition(competitionId);
  const title = allocationTitle(legRound);

  const refreshReads = () =>
    Promise.all([allocations.refetch(), registrations.refetch(), ...(legRound ? [rankings.refetch()] : [])]);

  // fish handleRefetch (onSettled): the competition, the allocations and the registrations list.
  const refetchAfterSave = () => {
    void qc.invalidateQueries({ queryKey: competitionsKeys.byId(competitionId) });
    void qc.invalidateQueries({ queryKey: competitionManagementKeys.allocatedParticipants(competitionId) });
    void qc.invalidateQueries({ queryKey: competitionsKeys.registrationsListById(competitionId) });
  };

  const onSuccess = (message: string) => {
    setSaved(true);
    toast(message, 'success');
    router.replace(back);
  };

  const block = data ? allocationBlock(data, legRound) : null;
  const editable = Boolean(seats) && !block;

  const onSave = () => {
    if (!seats || saving || saved || block) return;
    // Nothing changed: no request (the CMS would notify every participant again).
    if (!legRound && !dirty) return;
    const body = allocationsBody(seats);
    if (legRound) {
      allocateLeg.mutate(
        { competitionId, round: legRound, allocations: body.allocations },
        {
          onSuccess: () => onSuccess(legSavedMessage(legRound)),
          onError: (error) => toast(saveErrorMessage(error), 'danger'),
          onSettled: refetchAfterSave,
        },
      );
      return;
    }
    allocate.mutate(
      { competitionId, body },
      {
        onSuccess: () => onSuccess(SAVED_MESSAGE),
        onError: (error) => toast(saveErrorMessage(error), 'danger'),
        onSettled: refetchAfterSave,
      },
    );
  };

  return (
    <>
      <ManagementFrame
        competitionId={competitionId}
        viewer={viewer}
        title={title}
        titleId={ALLOCATION_TITLE_ID}
        requires="author"
        back={{ href: back, label: 'Înapoi la concurs' }}
        reads={[allocations]}
        onRefresh={refreshReads}
        skeleton={<AllocationBodySkeleton />}
        asideSkeleton={<FlowAsideSkeleton />}
        hint={({ competition: c }) => (c?.lake ? <span>{c.lake.name}</span> : null)}
        aside={({ competition: c }) =>
          c && seats && editable && c.sectors.length > 0 ? <SummaryCard competition={c} seats={seats} legRound={legRound} /> : null
        }
        actions={({ competition: c }) =>
          c && seats && editable && c.sectors.length > 0 ? (
            <SaveBar competition={c} seats={seats} legRound={legRound} dirty={dirty} saving={saving} saved={saved} onSave={onSave} />
          ) : null
        }
      >
        {({ competition: c }) =>
          c && block ? (
            <T4Gate
              icon={<LockClosedIcon />}
              title={block.title}
              description={block.description}
              align="start"
              actions={
                <ButtonLink variant="secondary" href={back}>
                  Înapoi la concurs
                </ButtonLink>
              }
            />
          ) : c && seats ? (
            <Allocation
              competition={c}
              seats={seats}
              allocated={allocations.data}
              legRound={legRound}
              busy={saving || saved}
              onOpen={(p) => setPicking(p)}
              onClear={(standId) => initial && setEdits((e) => withSeatEdit(initial, e, standId, ''))}
            />
          ) : null
        }
      </ManagementFrame>
      {data && seats && editable ? (
        <RegistrationPicker
          open={picking !== null}
          title={picking ? `Sector ${picking.sectorName} · Stand ${picking.standName}` : 'Stand'}
          options={options}
          onClose={() => setPicking(null)}
          onPick={(registrationId) => {
            if (picking && initial) setEdits((e) => withSeatEdit(initial, e, picking.standId, registrationId));
            setPicking(null);
          }}
        />
      ) : null}
      {leaveDialog}
    </>
  );
}

function Allocation({
  competition,
  seats,
  allocated,
  legRound,
  busy,
  onOpen,
  onClear,
}: {
  competition: CompetitionWithMyStatus;
  seats: Seats;
  allocated: AllocatedParticipantsResponse | undefined;
  legRound: number | null;
  busy: boolean;
  onOpen: (p: Picking) => void;
  onClear: (standId: string) => void;
}) {
  const palette = useMemo(() => sectorPalette(competition), [competition]);
  return (
    <>
      {legRound ? (
        <p className="t-body max-w-prose text-ink-2" data-testid="alloc-leg-intro">
          {legIntro(legRound)}
        </p>
      ) : null}
      {competition.sectors.length === 0 ? (
        <div className="flex items-start gap-3" data-testid="alloc-no-sectors">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-soft-fill text-ink-2">
            <Squares2X2Icon className="size-6" />
          </span>
          <p className="t-body min-w-0 flex-1 pt-2 text-ink-2">
            Concursul nu are sectoare. Alege întâi sectoarele și standurile lor, apoi revino aici.
          </p>
        </div>
      ) : (
        <div className={SECTOR_COLUMNS} data-testid="alloc-sectors">
          {orderedSectors(competition).map((sector) => {
            const tone = palette.get(sector.documentId);
            const fill = sectorFill(tone?.letter ?? '', tone?.color ?? 'var(--color-muted)');
            const filled = sector.stands.filter((s) => seats[s.documentId]).length;
            const headingId = `alloc-sector-${sector.documentId}`;
            return (
              <section key={sector.documentId} aria-labelledby={headingId} className={SECTOR_CARD} data-testid={`alloc-sector-${sector.name}`}>
                <span aria-hidden className={cn('-mx-3 hidden h-1 md:block', fill.className)} style={fill.style} />
                <div className="flex items-center gap-2">
                  <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full md:hidden', fill.className)} style={fill.style} />
                  <h2 id={headingId} className="t-title2 text-ink md:t-heading">
                    Sector {sector.name}
                  </h2>
                  <span className="t-caption ml-auto text-muted tabular-nums">
                    {filled}/{sector.stands.length}
                    <span className="sr-only"> standuri ocupate</span>
                  </span>
                </div>
                {sector.stands.length === 0 ? (
                  <p className="t-caption text-muted">Sectorul nu are standuri.</p>
                ) : (
                  <ul className={ROW_LIST}>
                    {sector.stands.map((stand) => {
                      const registrationId = seats[stand.documentId] ?? '';
                      return (
                        <li key={stand.documentId}>
                          <StandRow
                            standName={stand.name}
                            sectorName={sector.name}
                            occupant={occupantOf(competition, registrationId, allocated)}
                            filled={Boolean(registrationId)}
                            busy={busy}
                            onOpen={() => onOpen({ standId: stand.documentId, standName: stand.name, sectorName: sector.name })}
                            onClear={() => onClear(stand.documentId)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function SaveBar({
  competition,
  seats,
  legRound,
  dirty,
  saving,
  saved,
  onSave,
}: {
  competition: CompetitionWithMyStatus;
  seats: Seats;
  legRound: number | null;
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
}) {
  const { seated, registered } = seatCounts(competition, seats);
  const missing = Math.max(registered - seated, 0);
  // fish: disabled={isLegSeating && seatedCount !== registeredCount}
  // Leg seating: fish's gate. Normal allocation (web): nothing changed → nothing to send.
  const blocked = legRound ? seated !== registered : !dirty;
  const hint = legRound
    ? blocked
      ? missing > 0
        ? `Fără stand: ${formatCount(missing, 'înscriere', 'înscrieri')}.`
        : 'Sunt ocupate mai multe standuri decât înscrieri confirmate.'
      : 'Toți participanții au stand.'
    : `${seated} din ${formatCount(registered, 'înscriere confirmată', 'înscrieri confirmate')} ${seated === 1 ? 'are' : 'au'} stand.`;
  return (
    <FlowActions
      hint={
        <span id="alloc-save-hint">
          <span data-testid="alloc-progress">{hint}</span>
          {!legRound && !dirty && !saved ? <span data-testid="alloc-no-changes"> {NO_CHANGES}</span> : null}
        </span>
      }
      primary={
        <Button
          onClick={onSave}
          disabled={blocked || saving || saved}
          aria-describedby="alloc-save-hint"
          aria-busy={saving || undefined}
          icon={saving ? <T4Spinner /> : undefined}
          data-testid="alloc-save"
        >
          {legRound ? `Salvează standurile (${seated}/${registered})` : 'Finalizează alocarea'}
        </Button>
      }
    />
  );
}

/** ≥1280: seated / registered, each sector's count with its colour, and who has no stand yet. */
function SummaryCard({ competition, seats, legRound }: { competition: CompetitionWithMyStatus; seats: Seats; legRound: number | null }) {
  const palette = sectorPalette(competition);
  const { seated, registered } = seatCounts(competition, seats);
  const waiting = unseated(competition, seats);
  const shown = waiting.slice(0, 8);
  return (
    <FlowAsideCard title={legRound ? `Manșa ${legRound}` : 'Alocare'} id="alocare-rezumat">
      <p className="flex items-baseline gap-2" data-testid="alloc-summary">
        <span className="t-title1 text-ink tabular-nums">
          {seated}
          <span className="text-muted">/{registered}</span>
        </span>
        <span className="t-caption text-muted">{registered === 1 ? 'înscriere are stand' : 'înscrieri au stand'}</span>
      </p>
      <ul className={cn('flex flex-col', competition.sectors.length > 8 && 'grid grid-cols-2 gap-x-4')}>
        {orderedSectors(competition).map((s) => {
          const tone = palette.get(s.documentId);
          const fill = sectorFill(tone?.letter ?? '', tone?.color ?? 'var(--color-muted)');
          const filled = s.stands.filter((st) => seats[st.documentId]).length;
          return (
            <li key={s.documentId} className="flex min-h-9 items-center gap-2">
              <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', fill.className)} style={fill.style} />
              <span className="t-body text-ink">Sector {s.name}</span>
              <span className="t-caption ml-auto text-muted tabular-nums">
                {filled}/{s.stands.length}
                <span className="sr-only"> standuri ocupate</span>
              </span>
            </li>
          );
        })}
      </ul>
      {waiting.length > 0 ? (
        <div className="flex flex-col gap-1.5 border-t border-hairline pt-3" data-testid="alloc-unseated">
          <h3 className="t-caption font-semibold text-ink-2">Fără stand ({waiting.length})</h3>
          <ul className="flex flex-wrap gap-1.5">
            {shown.map((w) => (
              <li key={w.registrationId} className="t-caption max-w-full truncate rounded-full bg-soft-fill px-2.5 py-1 text-ink-2">
                {w.label}
              </li>
            ))}
            {waiting.length > shown.length ? (
              <li className="t-caption px-1 py-1 text-muted">și încă {waiting.length - shown.length}</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </FlowAsideCard>
  );
}
