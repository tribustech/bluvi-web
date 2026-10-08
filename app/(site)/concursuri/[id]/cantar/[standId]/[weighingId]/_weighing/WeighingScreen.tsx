'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowPathIcon, ExclamationTriangleIcon, PlusIcon } from '@heroicons/react/24/outline';
import {
  competitionKeys,
  competitionQuery,
  competitionsKeys,
  currentLegOf,
  rankingsKeys,
  type CompetitionWithMyStatus,
} from '@/core/competitions';
import {
  addCatchMutationKey,
  allocatedParticipantsQuery,
  competitionManagementKeys,
  deleteCatchMutation,
  endCantarMutation,
  formatStandLabel,
  uploadRefereeSignatureMutation,
  uploadWitnessSignatureMutation,
  weighingByIdQuery,
  weighingKeys,
  weighingsQuery,
  type AllocatedParticipantsResponse,
  type WeighingDetail,
  type WeighingDetailCatch,
} from '@/core/organizer';
import { formatCount } from '@/core/realtime/chat/format';
import { Dialog } from '@/components/surfaces/Dialog';
import { FlowActions, FlowAsideCard, FlowSubjectCard } from '@/components/templates/T6';
import { Button, ButtonLink } from '@/components/ui/Button';
import { SignatureNumber } from '@/components/ui/SignatureNumber';
import { StatusPill } from '@/components/ui/StatusPill';
import { routes } from '@/lib/routes';
import { useSiteToast } from '@/app/(site)/_shell/Toast';
import { ManagementFrame, useManagementTransport, type ManagementViewer } from '../../../../_organizer/ManagementFrame';
import { fold } from '../../../../_organizer/occupant';
import { useNavigationGuard } from '../../../../_organizer/useNavigationGuard';
import { AddCatchDialog } from './AddCatchDialog';
import { CatchList } from './CatchList';
import { kg, revisionsCopy, signatureFilename, totalKg, weighingPermissions, weighingTitle } from './model';
import { ReopenDialog } from './ReopenDialog';
import { SignatureFlow } from './SignatureFlow';
import { SignaturesDialog } from './SignaturesDialog';
import { WeighingAsideSkeleton, WeighingBodySkeleton } from './WeighingSkeleton';

/*
 * One weighing (parity organizer.scale-weighing; fish app/(app)/scale/[competitionId]/add.tsx). T6 via
 * ManagementFrame. Signed in only (proxy + requireViewer); any signed-in viewer may read it (fish lets
 * every role open it) — what they may DO follows the statute (model.weighingPermissions):
 *  - c1 «Cântar N» (the weighing's place in the stand's list) with «Total: x,xxx kg» under it;
 *  - c2 the stand card (NC: national label + club), «Echipa …», the anglers or the guest as bullets;
 *  - c3 «Acest cântar a avut … modificări.» → the revisions page; c18 «Vezi istoric» when finished;
 *  - c4/c5 the catches (CatchList), newest first; add / delete / finalize for author or referee while open;
 *  - c6 delete asks first, toasts, refetches the weighing and the stand's weighings;
 *  - c7–c13 AddCatchDialog; c14 «Finalizează cântarul» refuses while a catch is unconfirmed;
 *  - c15/c16 SignatureFlow → upload both PNGs → POST /weighings/:id/end → toast → back to the stand;
 *  - c17 «Vezi semnături» (anyone with a role, finished); c19/c20 «Redeschide cântarul» (author);
 *  - c21 the header's refresh refetches the weighing, the allocations and the statute.
 * Desktop (≥1280): the catches table in the task, the stand card + the total in the sticky aside, the
 * actions docked under it. Reads: GET /feed/weighings/:id, /competitions/:id/allocated-participants,
 * /feed/weighings/by-stand (the number), the competition and the statute (the frame). Writes: the CMS's
 * own weighing routes only — each one pushes to real participants.
 */

/** fish queryKeys.competitions.liveWithNewExtraScales — owned by fish's live banner, not in core yet. */
const LIVE_WITH_NEW_EXTRA_SCALES = ['competitions', 'live', 'extra-scale-new'] as const;

type Props = { competitionId: string; standId: string; weighingId: string; viewer: ManagementViewer };

export function WeighingScreen({ competitionId, standId, weighingId, viewer }: Props) {
  const t = useManagementTransport();
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useSiteToast();
  const guard = useNavigationGuard();

  const competition = useQuery(competitionQuery(t, competitionId, { isAuthenticated: true }));
  const weighing = useQuery(weighingByIdQuery(t, weighingId));
  const allocations = useQuery(allocatedParticipantsQuery(t, competitionId));
  const round = currentLegOf(competition.data);
  const standWeighings = useQuery(weighingsQuery(t, competitionId, standId, { enabled: competition.isSuccess, round }));

  const [adding, setAdding] = useState(false);
  const [signing, setSigning] = useState(false);
  const [finishing, setFinishing] = useState(false);
  // finalize's re-entry guard: state is read from a stale closure, a ref is not (a double «Mai departe»).
  const finalizingRef = useRef(false);
  const [showSignatures, setShowSignatures] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [toDelete, setToDelete] = useState<{ c: WeighingDetailCatch; index: number } | null>(null);

  // fish useIsMutating(addCatchMutationKey): a catch POST in flight blocks the signatures — and so does
  // the rest of the dialog's chain (its photos compressing before the POST, uploading after it).
  const [catchSubmitting, setCatchSubmitting] = useState(false);
  const unconfirmed = useIsMutating({ mutationKey: addCatchMutationKey(weighingId) }) > 0 || catchSubmitting;
  const remove = useMutation(deleteCatchMutation(t));
  const end = useMutation(endCantarMutation(t, qc, { weighingId, competitionId }));
  const uploadReferee = useMutation(uploadRefereeSignatureMutation(t));
  const uploadWitness = useMutation(uploadWitnessSignatureMutation(t));

  // The title waits for the stand's list (no «Cântar» → «Cântar 2» swap); a failed read keeps «Cântar»:
  // the list is NOT one of the frame's `reads` (fish gates on the weighing and the allocations only).
  const listPending = standWeighings.isPending && standWeighings.fetchStatus !== 'idle';
  const title =
    weighing.data && !listPending
      ? weighingTitle(weighingId, standWeighings.data, weighing.data.weighingType)
      : weighing.isPending || listPending || competition.isPending
        ? ''
        : 'Cântar';

  const historyHref = routes.competitionScaleStand(competitionId, standId);
  const revisionsHref = routes.competitionScaleRevisions(competitionId, standId, weighingId);

  const confirmDelete = () => {
    if (!toDelete) return;
    const id = toDelete.c.documentId;
    setToDelete(null);
    remove.mutate(id, {
      onSuccess: () => toast('Captură ștearsă cu succes!', 'success'),
      onError: (error) => toast(error.message || 'Captura nu a fost ștearsă.', 'danger'),
      onSettled: () => {
        void qc.invalidateQueries({ queryKey: weighingKeys.byId(weighingId) });
        // fish: the stand's history shows this weighing's totals.
        void qc.invalidateQueries({ queryKey: weighingKeys.byCompetitionId(competitionId) });
      },
    });
  };

  // c19: reopen only when the CMS can accept it (model.reopenAllowed).
  const reopenCtx = { weighingId, competition: competition.data, standWeighings: standWeighings.data };

  const startFinalize = () => {
    if (unconfirmed) {
      toast('Așteaptă confirmarea capturilor înainte de a finaliza cântarul.', 'danger');
      return;
    }
    if (finishing || finalizingRef.current) return;
    setSigning(true);
  };

  /**
   * c16 (fish handleEndCantar): both signatures up, then the close. Unlike fish (which fires the three
   * writes together and closes even when an upload fails), the close waits for both uploads: a
   * weighing closed without its signatures cannot be signed again without reopening it.
   */
  const finalize = async (signatures: { referee: Blob; witness: Blob }) => {
    if (finalizingRef.current) return;
    setSigning(false);
    const w = weighing.data;
    if (!w) {
      toast('Nu există un cântar pentru a finaliza.', 'danger');
      return;
    }
    finalizingRef.current = true;
    setFinishing(true);
    try {
      await Promise.all([
        uploadReferee.mutateAsync({ id: w.id, files: [{ blob: signatures.referee, filename: signatureFilename('referee', w.documentId) }] }),
        uploadWitness.mutateAsync({ id: w.id, files: [{ blob: signatures.witness, filename: signatureFilename('witness', w.documentId) }] }),
      ]);
    } catch (error) {
      finalizingRef.current = false;
      setFinishing(false);
      toast((error as Error).message || 'Nu s-au putut încărca semnăturile.', 'danger');
      return;
    }
    end.mutate(undefined, {
      onSuccess: () => {
        toast('Cântarul a fost finalizat cu succes!', 'success');
        router.replace(historyHref);
      },
      onError: (error) => {
        finalizingRef.current = false;
        setFinishing(false);
        toast(error.message || 'Cântarul nu a fost finalizat.', 'danger');
      },
      onSettled: () => {
        void qc.invalidateQueries({ queryKey: competitionsKeys.byId(competitionId) });
        void qc.invalidateQueries({ queryKey: rankingsKeys.byCompetitionId(competitionId) });
        void qc.invalidateQueries({ queryKey: competitionKeys.live });
        void qc.invalidateQueries({ queryKey: competitionManagementKeys.extraScalesList(competitionId) });
        void qc.invalidateQueries({ queryKey: LIVE_WITH_NEW_EXTRA_SCALES });
        void qc.invalidateQueries({ queryKey: weighingKeys.byCompetitionId(competitionId) });
      },
    });
  };

  return (
    <>
      <ManagementFrame
        competitionId={competitionId}
        viewer={viewer}
        title={title}
        titleId="cantar-titlu"
        requires="signedIn"
        back={{ href: historyHref, label: 'Înapoi la cântăriri' }}
        reads={[weighing, allocations]}
        onRefresh={() => Promise.all([weighing.refetch(), allocations.refetch(), standWeighings.refetch()])}
        skeleton={<WeighingBodySkeleton />}
        asideSkeleton={<WeighingAsideSkeleton />}
        hint={() => (weighing.data ? <TotalLine weighing={weighing.data} /> : null)}
        aside={({ competition: c }) =>
          weighing.data && c ? (
            <>
              <StandCard competition={c} allocations={allocations.data} standId={standId} weighing={weighing.data} />
              <TotalCard weighing={weighing.data} />
            </>
          ) : null
        }
        actions={({ role }) => {
          const w = weighing.data;
          if (!w) return null;
          const can = weighingPermissions(role, w.weighingStatus, reopenCtx);
          if (can.actions) {
            const busy = finishing || unconfirmed;
            return (
              <FlowActions
                hint={unconfirmed ? 'Se confirmă capturile…' : finishing ? 'Se finalizează cântarul…' : undefined}
                primary={
                  <Button
                    block
                    onClick={startFinalize}
                    aria-busy={busy || undefined}
                    icon={busy ? <ArrowPathIcon className="motion-safe:animate-spin" /> : undefined}
                    data-testid="finalize"
                  >
                    Finalizează cântarul
                  </Button>
                }
                secondary={
                  <Button block variant="outline" icon={<PlusIcon />} onClick={() => setAdding(true)} disabled={finishing}>
                    Adaugă captură
                  </Button>
                }
              />
            );
          }
          const history = w.weighingStatus === 'finished' && w.numberOfRevisions > 0;
          const buttons = [
            can.signatures ? (
              <Button key="sig" block onClick={() => setShowSignatures(true)}>
                Vezi semnături
              </Button>
            ) : null,
            history ? (
              <ButtonLink key="hist" block variant="outline" href={revisionsHref} onClick={(e) => guard(e)}>
                Vezi istoric
              </ButtonLink>
            ) : null,
            can.reopen ? (
              <Button key="reopen" block variant="danger" onClick={() => setReopening(true)}>
                Redeschide cântarul
              </Button>
            ) : null,
          ].filter(Boolean);
          if (buttons.length === 0) return null;
          return <FlowActions primary={buttons[0]} secondary={buttons.length > 1 ? <>{buttons.slice(1)}</> : undefined} />;
        }}
      >
        {({ competition: c, role }) => {
          const w = weighing.data;
          if (!w || !c) return null;
          const can = weighingPermissions(role, w.weighingStatus, reopenCtx);
          return (
            <>
              <div className="flex flex-col gap-2 xl:hidden">
                <StandCard competition={c} allocations={allocations.data} standId={standId} weighing={w} />
              </div>
              {w.numberOfRevisions > 0 ? (
                <Link
                  href={revisionsHref}
                  onClick={(e) => guard(e)}
                  data-testid="revisions-link"
                  className="t-body -my-1 flex items-center gap-1.5 self-start rounded-control py-1 text-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <ExclamationTriangleIcon aria-hidden className="size-4 shrink-0 text-status-danger-fg" />
                  {revisionsCopy(w.numberOfRevisions)}
                </Link>
              ) : null}
              <section aria-labelledby="capturi-titlu" className="flex flex-col gap-3">
                <div className="flex items-baseline gap-2">
                  <h2 id="capturi-titlu" className="t-title2 text-ink">
                    Capturi
                  </h2>
                  {w.catches.length > 0 ? (
                    <span className="t-caption text-muted">{formatCount(w.catches.length, 'captură', 'capturi')}</span>
                  ) : null}
                </div>
                <CatchList catches={w.catches} canDelete={can.actions} onDelete={(c2, index) => setToDelete({ c: c2, index })} />
              </section>
            </>
          );
        }}
      </ManagementFrame>

      <AddCatchDialog
        open={adding}
        onClose={() => setAdding(false)}
        t={t}
        competitionId={competitionId}
        weighingId={weighingId}
        onSubmittingChange={setCatchSubmitting}
      />
      <SignatureFlow open={signing} onClose={() => setSigning(false)} onSigned={(s) => void finalize(s)} />
      <SignaturesDialog
        open={showSignatures}
        onClose={() => setShowSignatures(false)}
        referee={weighing.data?.refereeSignature ?? null}
        witness={weighing.data?.witnessSignature ?? null}
      />
      <ReopenDialog
        open={reopening}
        onClose={() => setReopening(false)}
        t={t}
        competitionId={competitionId}
        standId={standId}
        weighingId={weighingId}
      />
      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        alert
        title="Ești sigur că vrei să ștergi captura?"
        description="Această captură va fi eliminată și nu va mai putea fi recuperată."
        actions={
          <>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Închide
            </Button>
            <Button variant="danger" onClick={confirmDelete} data-testid="delete-confirm">
              Șterge
            </Button>
          </>
        }
      >
        {toDelete ? (
          <p className="t-body-strong text-ink">
            {toDelete.index + 1}. {toDelete.c.fishType?.Name}: {kg(toDelete.c.weight)} kg
          </p>
        ) : null}
      </Dialog>
    </>
  );
}

/** c1: «Total: x,xxx kg» under the title, then the weighing's state. */
function TotalLine({ weighing }: { weighing: WeighingDetail }) {
  return (
    <>
      <span className="t-heading text-muted" data-testid="weighing-total">
        Total: <span className="text-accent-ink tabular-nums">{kg(totalKg(weighing))}</span>&nbsp;kg
      </span>
      <StatusPill tone={weighing.weighingStatus === 'finished' ? 'neutral' : 'info'}>
        {weighing.weighingStatus === 'finished' ? 'Finalizat' : 'În curs'}
      </StatusPill>
    </>
  );
}

/**
 * c2 (fish add.tsx:283-317): the stand label — «Sector A, Stand 10», NC «Stand A1(10)» — the club
 * (NC), «Echipa <nume>», then the guest or the participants as bullets (a guest name repeating the
 * team is not printed twice, as the stand picker).
 */
function StandCard({
  competition,
  allocations,
  standId,
  weighing,
}: {
  competition: CompetitionWithMyStatus;
  allocations: AllocatedParticipantsResponse | undefined;
  standId: string;
  weighing: WeighingDetail;
}) {
  const sector = competition.sectors.find((s) => s.stands.some((st) => st.documentId === standId));
  const stand = sector?.stands.find((st) => st.documentId === standId);
  const alloc = allocations?.[standId] ?? null;
  const isNc = weighing.competition.rankingType === 'nationalChampionship';
  const sectorName = sector?.name ?? alloc?.sectorName ?? '';
  const label = formatStandLabel(isNc, sectorName, weighing.stand.sectorDrawPosition ?? alloc?.sectorDrawPosition ?? null, stand?.name ?? '');
  const team = alloc?.teamName || null;
  const people = alloc
    ? alloc.guestName
      ? team && fold(alloc.guestName.trim()) === fold(team.trim())
        ? []
        : [alloc.guestName]
      : alloc.participants.map((p) => p.name)
    : [];
  return (
    <FlowSubjectCard
      title={label}
      kicker={isNc && alloc?.clubName ? alloc.clubName : undefined}
      subtitle={team ? `Echipa ${team}` : undefined}
      people={people}
    />
  );
}

/** ≥1280: the total as the aside's signature number, with the catch count. */
function TotalCard({ weighing }: { weighing: WeighingDetail }) {
  const n = weighing.catches.length;
  return (
    <FlowAsideCard title="Total cântar" id="cantar-total">
      <SignatureNumber
        value={kg(totalKg(weighing))}
        unit="kg"
        size="stat"
        caption={n === 0 ? 'Nicio captură încă' : formatCount(n, 'captură', 'capturi')}
      />
    </FlowAsideCard>
  );
}
