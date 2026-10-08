'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useLeaveGuard } from '@/components/account/profile-form/useLeaveGuard';
import { T4TextArea } from '@/components/templates/T4';
import { FlowActions, FlowAsideCard, FlowLoadingStatus, FlowSubjectCard } from '@/components/templates/T6';
import { Button } from '@/components/ui/Button';
import { competitionQuery, competitionRegistrationsListQuery, type PenaltyAction } from '@/core/competitions';
import {
  PENALTY_REASON_MAX,
  PENALTY_REASON_MIN,
  createPenaltyMutation,
  toCreatePenaltyParams,
  type PenaltyFormValues,
} from '@/core/organizer';
import { routes } from '@/lib/routes';
import { useSiteToast } from '@/app/(site)/_shell/Toast';
import { ManagementFrame, useManagementTransport, type ManagementViewer } from '../../../_organizer/ManagementFrame';
import { isAuthorOrReferee } from '../../../_organizer/access';
import { useCompetitionRole } from '../../../_organizer/useCompetitionRole';
import { ActionCards, PenaltyCardMarker } from './ActionCards';
import { APPLY_TITLE, APPLY_TITLE_ID, ApplyAsideSkeleton, ApplyBodySkeleton } from './ApplySkeleton';
import {
  APPLIED_MESSAGE,
  EMPTY_FORM,
  actionOption,
  applyErrorOutcome,
  isDirty,
  penaltyKg,
  resolveApplyTarget,
  subjectOf,
  validatePenalty,
  type Subject,
} from './model';

/*
 * «Aplică penalizare» (parity organizer.penalties-apply; fish app/(app)/penalties/[competitionId]/apply.tsx).
 * T6 via ManagementFrame, author or referee only (fish reaches it from the hub's author/referee CTA;
 * the CMS re-checks: PENALTY:UNAUTHORIZED_ACCESS). Reads: the competition + statute (the frame) and
 * GET /competitions/:id/registrations. One write: POST /competitions/:id/registrations/:rid/penalties —
 * it pushes to every participant, referee and follower and posts in the competition chat.
 *  - c1 the subject card: «Sector X, Stand N», «Echipa …» or the angler, the members as bullets;
 *  - c2 no / unknown `inscriere` → back to the stand picker; ranking type without penalties → the hub;
 *  - c3/c4 ActionCards; c5 «Motiv» 5–255 with its counter;
 *  - c6 «Aplică» → the trimmed reason, the value only for a weight penalty → toast → the hub
 *    (createPenaltyMutation refetches the rankings and the best-N ranking);
 *  - c7 ALREADY_ELIMINATED inline under «Tip penalizare» (cleared when the action changes), the rest a toast.
 * Errors show as fish's onChange form does: a field's message once it was edited, all of them after a
 * submit. Unsaved input is guarded (useLeaveGuard). ≥1280: the form in the task card, the subject +
 * a live summary in the sticky aside, «Aplică» docked under it.
 */

type Props = { competitionId: string; registrationId: string | null; viewer: ManagementViewer };

export function ApplyForm({ competitionId, registrationId, viewer }: Props) {
  const t = useManagementTransport();
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useSiteToast();

  const competition = useQuery(competitionQuery(t, competitionId, { isAuthenticated: true }));
  // The registrations are the author's / referees' read: asked only once the statute allows it, so a
  // viewer without the role meets the frame's «Doar pentru organizator și arbitri», not a 403 error.
  const { role } = useCompetitionRole(t, competitionId);
  const readsRegistrations = Boolean(registrationId) && isAuthorOrReferee(role);
  const registrations = useQuery({ ...competitionRegistrationsListQuery(t, competitionId), enabled: readsRegistrations });
  const create = useMutation(createPenaltyMutation(t, qc, competitionId));

  const [values, setValues] = useState<PenaltyFormValues>(EMPTY_FORM);
  const [edited, setEdited] = useState<{ value?: boolean; reason?: boolean }>({});
  const [submitted, setSubmitted] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>();
  const [done, setDone] = useState(false);
  const valueRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const target = resolveApplyTarget({ competition: competition.data, registrations: registrations.data, registrationId });
  const registration = registrations.data?.find((r) => r.documentId === registrationId);

  // c2: fish router.back() / dismissTo(hub) — replace, so Back never lands on a form that bounces again.
  useEffect(() => {
    if (target === 'hub') router.replace(routes.competitionPenalties(competitionId));
    else if (target === 'back') router.replace(routes.competitionPenaltiesStand(competitionId));
  }, [target, router, competitionId]);

  const pending = create.isPending || done;
  const { dialog: leaveDialog } = useLeaveGuard(isDirty(values) && !pending);

  const errors = validatePenalty(values);
  const show = {
    value: values.action === 'DEDUCT_TOTAL_WEIGHT' && (submitted || edited.value) ? errors.value : undefined,
    reason: submitted || edited.reason ? errors.reason : undefined,
  };

  const setAction = (action: PenaltyAction) => {
    setActionError(undefined);
    setValues((v) => ({ ...v, action }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending || !registration) return;
    setSubmitted(true);
    if (values.action === 'DEDUCT_TOTAL_WEIGHT' && errors.value) {
      valueRef.current?.focus();
      return;
    }
    if (errors.reason) {
      reasonRef.current?.focus();
      return;
    }
    create.mutate(toCreatePenaltyParams(values, { competitionId, registrationId: registration.documentId }), {
      onSuccess: () => {
        setDone(true);
        toast(APPLIED_MESSAGE, 'success');
        router.replace(routes.competitionPenalties(competitionId));
      },
      onError: (error) => {
        const outcome = applyErrorOutcome(error);
        if ('inline' in outcome) setActionError(outcome.inline);
        else toast(outcome.toast, 'danger');
      },
    });
  };

  const ready = target === 'ready' && registration;

  return (
    <>
      <ManagementFrame
        competitionId={competitionId}
        viewer={viewer}
        title={APPLY_TITLE}
        titleId={APPLY_TITLE_ID}
        requires="authorOrReferee"
        back={{ href: routes.competitionPenaltiesStand(competitionId), label: 'Înapoi la standuri' }}
        reads={readsRegistrations ? [registrations] : []}
        onRefresh={() => (readsRegistrations ? registrations.refetch() : undefined)}
        skeleton={<ApplyBodySkeleton />}
        asideSkeleton={<ApplyAsideSkeleton />}
        asideMobile="hidden"
        aside={({ competition: c }) =>
          ready && c ? (
            <>
              <SubjectCard subject={subjectOf(c, registration)} />
              <Summary values={values} />
            </>
          ) : (
            <ApplyAsideSkeleton />
          )
        }
        actions={() =>
          ready ? (
            <FlowActions
              hint="Participanții, arbitrii și urmăritorii concursului primesc o notificare."
              primary={
                <Button
                  block
                  type="submit"
                  form="penalty-form"
                  aria-busy={pending || undefined}
                  disabled={pending}
                  icon={pending ? <ArrowPathIcon className="motion-safe:animate-spin" /> : undefined}
                  data-testid="penalty-apply-submit"
                >
                  {pending ? 'Se aplică…' : 'Aplică'}
                </Button>
              }
            />
          ) : null
        }
      >
        {({ competition: c }) => {
          if (!ready || !c) return <ApplyBodySkeleton label="Se deschide…" />;
          return (
            <form id="penalty-form" noValidate onSubmit={submit} className="flex flex-col gap-6 2xl:grid 2xl:grid-cols-2 2xl:items-start 2xl:gap-x-8" aria-labelledby={APPLY_TITLE_ID}>
              <div className="xl:hidden">
                <SubjectCard subject={subjectOf(c, registration)} />
              </div>
              <ActionCards
                action={values.action}
                onAction={setAction}
                actionError={actionError}
                value={values.value ?? ''}
                onValue={(value) => {
                  setEdited((s) => ({ ...s, value: true }));
                  setValues((v) => ({ ...v, value }));
                }}
                valueError={show.value}
                valueRef={valueRef}
                disabled={pending}
              />
              <section aria-labelledby="motiv-titlu" className="flex flex-col gap-3">
                <h2 id="motiv-titlu" className="t-title2 text-ink">
                  Motiv
                </h2>
                <T4TextArea
                  ref={reasonRef}
                  label="Motivul, așa cum îl vor citi participanții"
                  name="reason"
                  value={values.reason}
                  onChange={(e) => {
                    const reason = e.target.value;
                    setEdited((s) => ({ ...s, reason: true }));
                    setValues((v) => ({ ...v, reason }));
                  }}
                  placeholder={`Descrie motivul (${PENALTY_REASON_MIN}-${PENALTY_REASON_MAX} caractere)`}
                  maxLength={PENALTY_REASON_MAX}
                  capInput
                  rows={4}
                  error={show.reason}
                  disabled={pending}
                  data-testid="penalty-reason"
                />
              </section>
              {pending ? <FlowLoadingStatus label="Se aplică penalizarea…" /> : null}
            </form>
          );
        }}
      </ManagementFrame>
      {leaveDialog}
    </>
  );
}

function SubjectCard({ subject }: { subject: Subject }) {
  return (
    <div data-testid="penalty-subject">
      <FlowSubjectCard title={subject.title} subtitle={subject.line} people={subject.people} />
    </div>
  );
}

/**
 * ≥1280: what «Aplică» is about to do, as it is typed — the card, its effect, the weight (unit spaced,
 * rule 10) and the reason. A field not filled yet says so in muted copy, never a guess.
 */
function Summary({ values }: { values: PenaltyFormValues }) {
  const o = actionOption(values.action);
  const weight = values.action === 'DEDUCT_TOTAL_WEIGHT' ? penaltyKg(values.value) : null;
  const reason = values.reason.trim();
  return (
    <FlowAsideCard title="Rezumat" id="rezumat-penalizare">
      <dl data-testid="penalty-summary" className="flex flex-col divide-y divide-hairline">
        <div className="flex flex-col gap-1 pb-3">
          <dt className="sr-only">Tip</dt>
          <dd className="flex items-center gap-3">
            <PenaltyCardMarker tone={o.tone} />
            <span className="flex min-w-0 flex-col">
              <span className="t-body-strong text-ink">{o.label}</span>
              <span className="t-caption text-muted">{o.description}</span>
            </span>
          </dd>
        </div>
        {values.action === 'DEDUCT_TOTAL_WEIGHT' ? (
          <div className="flex items-baseline justify-between gap-3 py-3">
            <dt className="t-label text-ink-2">Greutate</dt>
            <dd className={weight ? 't-heading text-ink tabular-nums' : 't-caption text-muted'}>
              {weight ? (
                <>
                  {weight} <span className="t-body-strong text-muted">kg</span>
                </>
              ) : (
                'Necompletată'
              )}
            </dd>
          </div>
        ) : null}
        <div className="flex flex-col gap-1 pt-3">
          <dt className="t-label text-ink-2">Motiv</dt>
          <dd className={reason ? 't-body line-clamp-4 break-words text-ink' : 't-caption text-muted'}>{reason || 'Necompletat'}</dd>
        </div>
      </dl>
    </FlowAsideCard>
  );
}
