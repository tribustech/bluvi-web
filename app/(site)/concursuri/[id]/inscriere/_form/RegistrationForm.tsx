'use client';

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ExclamationTriangleIcon,
  IdentificationIcon,
  LockClosedIcon,
  PlusIcon,
  TrophyIcon,
  UserGroupIcon,
  UserIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  CDN_PURGE_SETTLE_MS,
  competitionQuery,
  competitionsKeys,
  isPendingTeamEntryOfSomeoneElse,
  registrationAction,
  createCompetitionRegistrationMutation,
  leaveCompetitionMutation,
  updateCompetitionRegistrationMutation,
  userStatuteForCompetitionQuery,
  type CompetitionWithMyStatus,
} from '@/core/competitions';
import { profileQuery, usersKeys } from '@/core/social';
import { isApiError } from '@/core/transport';
import { useLeaveGuard } from '@/components/account/profile-form/useLeaveGuard';
import { Field } from '@/components/forms/Field';
import { TextInput } from '@/components/forms/TextInput';
import { Dialog } from '@/components/surfaces/Dialog';
import {
  T4ActionBar,
  T4ErrorSummary,
  T4FieldGrid,
  T4Frame,
  T4Gate,
  T4Header,
  T4LineBar,
  T4Section,
  T4SectionSkeleton,
  T4Spinner,
  T4Summary,
  type T4Back,
  type T4Row,
  type T4FieldError,
} from '@/components/templates/T4';
import { STATE_CARD_FRAME } from '@/components/templates/stateCard';
import { Button, ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { track } from '@/lib/analytics';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../../_shell/SiteHeader';
import { useSiteToast } from '../../../../_shell/Toast';
import { COMPETITIONS_CRUMB } from '../../_components/crumbs';
import { competitionDateProse, competitionDateTime, displayEnd } from '../../_components/dates';
import { competitionThumb } from '../../_components/headerMeta';
import { EmptyTeamConfirm } from './EmptyTeamConfirm';
import { FishermanArt } from './FishermanArt';
import {
  anchorOf,
  canAddTeammate,
  createPayload,
  findEditedRegistration,
  footerState,
  formatLine,
  isDirty,
  needsEmptyTeamConfirm,
  registrationsSettle,
  seedKey,
  seedValues,
  submitErrorMessage,
  teamLimitCaption,
  updatePayload,
  validate,
  type Footer,
  type RegistrationValues,
  type Teammate,
} from './model';
import { StatusDialog, type StatusState } from './StatusDialog';
import { TeammatePicker } from './TeammatePicker';

/*
 * Înscriere — fish app/(app)/register/[competitionId].tsx (parity participant.register c1–c22), on
 * T4 (one step). The page (../page.tsx) only settles the session; everything here is per user and
 * read in the browser through /api/cms: the competition (core competitionQuery — its registrations
 * decide which entry is edited, c3), the profile (username, phone) and, when the URL asks for the
 * organizer mode, the viewer's statute in the competition (only its author gets that mode).
 *  - c1 loading: the skeleton of this page; c2 signed out (a dead session cookie: the proxy already
 *    sent cookie-less visitors to /intra) → fish's gate with the fisherman;
 *  - c4–c10 the fields, the team block and the teammate picker; c11 seeding / re-seeding;
 *  - c12 / c21 the footer; c13 the zero-teammates confirm; c14–c19 the writes and the status
 *    dialog; c20 the unsaved-changes guard (the site's leave dialog, useLeaveGuard); c22 the user
 *    search cache dropped on leaving.
 * Layout: phone — one column, the action bar pinned to the viewport's bottom edge. From 1024
 * (Airbnb's checkout, owner rule 1): the form column (≤720) on the left, a sticky summary card on
 * the right — the competition's picture, name, lake, dates, format and registration deadline (only
 * what it has, rule 4) with the actions under it.
 */

const FORM_ID = 'inscriere-form';
const TITLE_ID = 'inscriere-titlu';
const PHONE_ID = 'inscriere-telefon';
const TEAM_ID = 'inscriere-echipa';

export type RegistrationViewer = { documentId: string; username: string };

type Props = {
  competitionId: string;
  /** ?organizator=1 — honoured only when the viewer authors the competition. */
  organizerRequested: boolean;
  /** ?inscriere= — the registration the organizer edits. */
  registrationId: string | null;
  /** null: the session cookie is there but the CMS refused it — the c2 gate. */
  viewer: RegistrationViewer | null;
  /** This page's own path with its query (where /intra returns). */
  next: string;
};

export function RegistrationScreen(props: Props) {
  if (!props.viewer) return <SignedOutGate competitionId={props.competitionId} next={props.next} />;
  return <SignedIn {...props} viewer={props.viewer} />;
}

/* ============================================================================================== */
/* Data                                                                                           */
/* ============================================================================================== */

function SignedIn({ competitionId, organizerRequested, registrationId, viewer }: Props & { viewer: RegistrationViewer }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const session = { isAuthenticated: true };
  const competition = useQuery(competitionQuery(t, competitionId, session));
  const profile = useQuery(profileQuery(t));
  const statute = useQuery({
    ...userStatuteForCompetitionQuery(t, competitionId, session),
    enabled: organizerRequested,
  });

  // Once the form is on screen, the settle wait and the entry gates below no longer replace it: a
  // write's own refetch (a copy older than the write, the status dialog still open) must not unmount it.
  const [formShown, setFormShown] = useState(false);

  // c22 — leaving the page drops the cached user-search pages.
  useEffect(() => () => qc.removeQueries({ queryKey: usersKeys.paginated }), [qc]);

  const back: T4Back = {
    label: 'Înapoi la concurs',
    href: routes.competition(competitionId),
  };
  const name = competition.data?.name;
  const crumbs = (
    <SetBreadcrumb
      trail={[COMPETITIONS_CRUMB, ...(name ? [{ label: name, href: routes.competition(competitionId) }] : []), { label: 'Înscriere' }]}
    />
  );

  if (competition.isPending || profile.isPending || (organizerRequested && statute.isPending)) {
    return (
      <>
        {crumbs}
        <RegistrationSkeleton back={back} eyebrow={name} />
      </>
    );
  }

  // Organizer mode is honoured only once the statute says «author». A statute that cannot be read
  // never falls through to the viewer's own NEW registration (the author's entry would be
  // auto-approved by the CMS): the same error state, retrying the statute.
  const statuteFailed = organizerRequested && Boolean(registrationId) && statute.isError;

  if (competition.isError || profile.isError || statuteFailed) {
    const missing = competition.isError && isApiError(competition.error) && competition.error.status === 404;
    const retrying = competition.isFetching || profile.isFetching || statute.isFetching;
    return (
      <>
        {crumbs}
        <PageState back={back}>
          {missing ? (
            <T4Gate
              icon={<TrophyIcon />}
              title="Concursul nu a fost găsit"
              description="Poate a fost șters sau linkul nu mai este valabil."
              actions={<ButtonLink href={routes.competitions()}>Vezi concursurile</ButtonLink>}
            />
          ) : (
            <T4Gate
              tone="danger"
              role="alert"
              icon={<ExclamationTriangleIcon />}
              title="A apărut o eroare, te rugăm să încerci mai târziu"
              actions={
                <Button
                  onClick={() => {
                    if (competition.isError) void competition.refetch();
                    if (profile.isError) void profile.refetch();
                    if (statuteFailed) void statute.refetch();
                  }}
                  disabled={retrying}
                  aria-busy={retrying || undefined}
                  data-testid="registration-retry"
                >
                  Încearcă din nou
                </Button>
              }
            />
          )}
        </PageState>
      </>
    );
  }

  const organizerMode = organizerRequested && Boolean(registrationId) && statute.data?.userRole === 'author';
  const registration = findEditedRegistration(competition.data.registrations, {
    organizerMode,
    registrationId,
    viewerDocumentId: profile.data.documentId,
  });

  if (organizerMode && !registration) {
    // fish would fall back to a NEW registration of the organizer — a link to an entry that no
    // longer exists says so instead (rule 4).
    return (
      <>
        {crumbs}
        <PageState back={back} eyebrow={name}>
          <T4Gate
            icon={<UserGroupIcon />}
            title="Înscrierea nu a fost găsită"
            description="Poate a fost retrasă sau ștearsă între timp."
            actions={<ButtonLink href={routes.competitionParticipants(competitionId)}>Vezi participanții</ButtonLink>}
          />
        </PageState>
      </>
    );
  }

  // The registrations come from the edge-cached competition, my-status is live: right after a write
  // the two can disagree (registrationsSettle). Never offer a form built on the older copy.
  const settle = organizerMode || formShown ? 'ok' : registrationsSettle(competition.data.userRegistrationStatus, registration);
  if (settle !== 'ok') {
    return (
      <>
        {crumbs}
        <SettleWait competition={competition} back={back} eyebrow={name} />
      </>
    );
  }

  // fish never opens the form when the entry on the competition page is disabled
  // (participant.b.register-entry-disabled); a bookmark, the history or a stale tab does not either.
  // The viewer's own entry stays readable (locked, with the reason); anything else is a gate.
  let lockedReason: string | null = null;
  if (!organizerMode) {
    const action = registrationAction(competition.data, profile.data.documentId, new Date());
    if (action.disabled) {
      const ownEntry = registration && !isPendingTeamEntryOfSomeoneElse(competition.data, profile.data.documentId);
      if (!ownEntry && !formShown) {
        return (
          <>
            {crumbs}
            <PageState back={back} eyebrow={name}>
              <div className="contents" data-testid="registration-unavailable">
                <T4Gate
                  icon={<TrophyIcon />}
                  title={action.label === 'Înscrie-te' ? 'Înscrierea nu este disponibilă' : 'Înscrierea nu mai poate fi modificată'}
                  description={action.reason ?? undefined}
                  actions={<ButtonLink href={routes.competition(competitionId)}>Înapoi la concurs</ButtonLink>}
                />
              </div>
            </PageState>
          </>
        );
      }
      lockedReason = action.reason;
    }
  }

  return (
    <>
      {crumbs}
      <RegistrationForm
        t={t}
        competition={competition.data}
        profile={{
          documentId: profile.data.documentId,
          username: profile.data.username,
          phone: profile.data.phone,
        }}
        viewer={viewer}
        organizerMode={organizerMode}
        registration={registration}
        lockedReason={lockedReason}
        back={back}
        onShown={setFormShown}
      />
    </>
  );
}

/** How many re-reads (CDN_PURGE_SETTLE_MS apart) before the wait becomes an error with a retry. */
const SETTLE_TRIES = 5;

/**
 * The competition's registrations still predate the viewer's last write (my-status already says
 * otherwise): the page skeleton while the competition is re-read every CDN_PURGE_SETTLE_MS, then
 * the error state with a retry.
 */
function SettleWait({
  competition,
  back,
  eyebrow,
}: {
  competition: {
    refetch: () => Promise<unknown>;
    isFetching: boolean;
    dataUpdatedAt: number;
  };
  back: T4Back;
  eyebrow?: string;
}) {
  const [tries, setTries] = useState(0);
  const { refetch, dataUpdatedAt } = competition;
  useEffect(() => {
    if (tries >= SETTLE_TRIES) return;
    const id = window.setTimeout(() => {
      void refetch().finally(() => setTries(n => n + 1));
    }, CDN_PURGE_SETTLE_MS);
    return () => window.clearTimeout(id);
    // dataUpdatedAt: each new copy restarts the wait.
  }, [tries, refetch, dataUpdatedAt]);
  if (tries < SETTLE_TRIES) return <RegistrationSkeleton back={back} eyebrow={eyebrow} />;
  return (
    <PageState back={back} eyebrow={eyebrow}>
      <T4Gate
        tone="danger"
        role="alert"
        icon={<ExclamationTriangleIcon />}
        title="A apărut o eroare, te rugăm să încerci mai târziu"
        actions={
          <Button onClick={() => setTries(0)} disabled={competition.isFetching} data-testid="registration-retry">
            Încearcă din nou
          </Button>
        }
      />
    </PageState>
  );
}

/* ============================================================================================== */
/* The form                                                                                       */
/* ============================================================================================== */

type Registration = CompetitionWithMyStatus['registrations'][number];
type ProfileFacts = {
  documentId: string;
  username: string;
  phone: string | null;
};

function RegistrationForm({
  t,
  competition,
  profile,
  viewer,
  organizerMode,
  registration,
  lockedReason,
  back,
  onShown,
}: {
  t: ReturnType<typeof createBrowserTransport>;
  competition: CompetitionWithMyStatus;
  profile: ProfileFacts;
  viewer: RegistrationViewer;
  organizerMode: boolean;
  registration: Registration | null;
  /** The competition page's entry is disabled for this (own) entry: read-only, with the reason. */
  lockedReason: string | null;
  back: T4Back;
  onShown: (shown: true) => void;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useSiteToast();
  const competitionId = competition.documentId;
  const isTeam = competition.competitionType === 'team';
  const isNew = !registration;
  const viewerDocumentId = profile.documentId || viewer.documentId;
  useEffect(() => onShown(true), [onShown]);

  const seed = () =>
    seedValues(registration, {
      organizerMode,
      viewerDocumentId,
      profilePhone: profile.phone,
    });
  const [values, setValues] = useState<RegistrationValues>(seed);
  const [baseline, setBaseline] = useState<RegistrationValues>(values);
  const dirty = isDirty(values, baseline);

  // c11 — re-seed when the server data changes, unless the user already edited the form.
  const key = seedKey(registration, profile);
  const seededKey = useRef(key);
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  });
  useEffect(() => {
    if (key === seededKey.current) return;
    seededKey.current = key;
    if (dirtyRef.current) return;
    const next = seedValues(registration, {
      organizerMode,
      viewerDocumentId,
      profilePhone: profile.phone,
    });
    setValues(next);
    setBaseline(next);
    // Only the server data's identity (the key) re-seeds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const [submitted, setSubmitted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [status, setStatus] = useState<StatusState | null>(null);
  /** A write succeeded: the page is on its way back to the competition (the guard stands down). */
  const [finished, setFinished] = useState(false);

  const create = useMutation(createCompetitionRegistrationMutation(t, qc));
  const update = useMutation(updateCompetitionRegistrationMutation(t, qc));
  const leave = useMutation(leaveCompetitionMutation(t, qc));
  const busy = create.isPending || update.isPending || leave.isPending;

  // c20 — unsaved changes are never dropped silently (back chip, links, browser back, unload).
  const { dialog: leaveGuardDialog } = useLeaveGuard(dirty && !finished && !busy);

  const footer: Footer = footerState({
    registration,
    organizerMode,
    competitionStatus: competition.competitionStatus,
    lockedReason,
  });
  const errors = submitted ? validate(values, { isNew, isTeam }) : {};
  const summaryErrors: T4FieldError[] = [
    ...(errors.phone ? [{ id: PHONE_ID, label: 'Număr de telefon', message: errors.phone }] : []),
    ...(errors.teamName
      ? [
          {
            id: TEAM_ID,
            label: 'Numele echipei',
            message: errors.teamName,
            named: true,
          },
        ]
      : []),
  ];
  // The anchor (the viewer, or the entry's author in organizer mode) is on the team already: the
  // picker shows that row disabled instead of letting the CMS refuse a duplicate after submit.
  const anchor = anchorOf(registration, { organizerMode, viewerDocumentId });
  const taken = useMemo(
    () => new Set([...values.participants.map(p => p.documentId), ...(anchor ? [anchor] : [])]),
    [values.participants, anchor],
  );
  const pickerAnchor = anchor ? { documentId: anchor, label: organizerMode ? 'autorul înscrierii' : 'tu' } : null;
  const addAllowed = canAddTeammate(values.participants.length, competition.teamParticipants);
  // fish leaves the fields editable under «Nu poți face modificări»; nothing could save them, so the
  // web shows them read-only there.
  const locked = footer.kind === 'locked';

  const set = <K extends keyof RegistrationValues>(field: K, value: RegistrationValues[K]) => setValues(v => ({ ...v, [field]: value }));

  const goToCompetition = () => {
    setFinished(true);
    setStatus(null);
    router.replace(routes.competition(competitionId));
  };

  /**
   * After a create or a leave: the update's pattern (core updateCompetitionRegistrationMutation).
   * The competition is edge cached and purged ~0.65 s after the write, so a refetch now can store the
   * pre-write registrations for the whole staleTime: mark it stale now, re-read once the purge has
   * landed. (The page also waits on a disagreeing copy itself — registrationsSettle.)
   */
  const refetchAfterPurge = () => {
    const key = competitionsKeys.byId(competitionId);
    void qc.invalidateQueries({
      queryKey: key,
      exact: true,
      refetchType: 'none',
    });
    window.setTimeout(() => void qc.invalidateQueries({ queryKey: key, exact: true }), CDN_PURGE_SETTLE_MS);
  };

  /** fish handleSubmit(onCreate / onUpdate): validate, then write. */
  const write = () => {
    setSubmitted(true);
    setAttempt(a => a + 1);
    if (Object.keys(validate(values, { isNew, isTeam })).length > 0) return;
    if (isNew) {
      const payload = createPayload(values, {
        competitionId,
        viewerDocumentId,
        profilePhone: profile.phone,
      });
      setStatus({ kind: 'create', phase: 'pending' });
      create.mutate(payload, {
        onSuccess: () => {
          refetchAfterPurge();
          track('competition_registration_created', {
            competition_id: competitionId,
            participants: payload.participants.length,
          });
          setFinished(true);
          setStatus({ kind: 'create', phase: 'success' });
        },
        onError: error =>
          setStatus({
            kind: 'create',
            phase: 'error',
            message: submitErrorMessage(error),
          }),
      });
      return;
    }
    let payload;
    try {
      payload = updatePayload(values, {
        competitionId,
        registrationId: registration?.documentId,
        anchor: anchorOf(registration, { organizerMode, viewerDocumentId }),
      });
    } catch (error) {
      setStatus({
        kind: 'update',
        phase: 'error',
        message: submitErrorMessage(error),
      });
      return;
    }
    setStatus({ kind: 'update', phase: 'pending' });
    const saved = values;
    update.mutate(payload, {
      onSuccess: () => {
        // c18 — the saved values become the baseline (not dirty), so the refetch can re-seed.
        setBaseline(saved);
        track('competition_registration_updated', {
          competition_id: competitionId,
          participants: payload.participants.length,
        });
        setFinished(true);
        setStatus({ kind: 'update', phase: 'success' });
      },
      onError: error =>
        setStatus({
          kind: 'update',
          phase: 'error',
          message: submitErrorMessage(error),
        }),
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy || footer.kind === 'locked') return;
    if (footer.kind === 'update' && !dirty) return;
    // c13 — fish asks before validating (checkForEmptyParticipants wraps handleSubmit).
    if (needsEmptyTeamConfirm(competition.competitionType, values.participants.length)) {
      setConfirmEmpty(true);
      return;
    }
    write();
  };

  const leaveCompetition = () => {
    setConfirmLeave(false);
    if (!registration) return;
    setStatus({ kind: 'leave', phase: 'pending' });
    leave.mutate(registration.documentId, {
      onSuccess: () => {
        refetchAfterPurge();
        setFinished(true);
        setStatus({ kind: 'leave', phase: 'success' });
      },
      onError: error => {
        // fish: the error as a toast (the leave sheet has no message of its own).
        setStatus(null);
        toast(submitErrorMessage(error), 'danger');
      },
    });
  };

  const removeTeammate = (documentId: string) =>
    set(
      'participants',
      values.participants.filter(p => p.documentId !== documentId),
    );
  const addTeammate = (user: Teammate) => {
    setPickerOpen(false);
    if (taken.has(user.documentId)) return;
    set('participants', [...values.participants, user]);
  };

  const actions = <FooterActions footer={footer} dirty={dirty} busy={busy} onLeave={() => setConfirmLeave(true)} />;
  const username = organizerMode ? (registration?.author?.username ?? '') : profile.username;

  return (
    <>
      <T4Frame
        label="Înscriere"
        header={<T4Header title="Înscriere" titleId={TITLE_ID} eyebrow={competition.name} back={back} busy={busy} />}
        actions={<BarActions footer={footer} dirty={dirty} busy={busy} onLeave={() => setConfirmLeave(true)} />}
      >
        <TwoColumns
          aside={
            <CompetitionSummary competition={competition}>
              <div className="flex flex-col gap-2.5" data-testid="registration-actions-desktop">
                {actions}
              </div>
            </CompetitionSummary>
          }
        >
          <CompetitionSummary competition={competition} compact />
          {organizerMode ? (
            <p className="t-caption -mb-1 text-muted" data-testid="organizer-mode">
              Modifici înscrierea lui {registration?.author?.username ?? 'participantului'} ca organizator.
            </p>
          ) : null}
          <T4ErrorSummary errors={summaryErrors} attempt={attempt} />
          <form id={FORM_ID} noValidate onSubmit={submit} aria-labelledby={TITLE_ID} className="flex flex-col gap-4 md:gap-5">
            <T4Section title={organizerMode ? 'Datele participantului' : 'Datele tale'} icon={<IdentificationIcon />}>
              <T4FieldGrid>
                <ReadOnlyField label="Nume utilizator*" value={username} data-testid="registration-username" />
                {isNew ? (
                  profile.phone ? (
                    <ReadOnlyField
                      id={PHONE_ID}
                      label="Număr de telefon*"
                      value={values.phone}
                      helper="Numărul din profilul tău."
                      data-testid="registration-phone"
                    />
                  ) : (
                    <TextInput
                      id={PHONE_ID}
                      label="Număr de telefon*"
                      placeholder="Introdu numărul de telefon"
                      inputMode="numeric"
                      autoComplete="tel"
                      value={values.phone}
                      onChange={e => set('phone', e.currentTarget.value)}
                      aria-required
                      error={errors.phone}
                      data-testid="registration-phone"
                    />
                  )
                ) : null}
              </T4FieldGrid>
            </T4Section>
            {isTeam ? (
              <>
                {locked && !values.teamName ? null : (
                  <T4Section title="Echipa" icon={<UserGroupIcon />}>
                    {locked ? (
                      <ReadOnlyField id={TEAM_ID} label="Numele echipei" value={values.teamName} data-testid="registration-team-name" />
                    ) : (
                      <TextInput
                        id={TEAM_ID}
                        label="Numele echipei"
                        placeholder="Introdu numele echipei"
                        helper="Numele echipei este opțional și poate fi adăugat ulterior"
                        value={values.teamName}
                        onChange={e => set('teamName', e.currentTarget.value)}
                        error={errors.teamName}
                        data-testid="registration-team-name"
                      />
                    )}
                  </T4Section>
                )}
                {locked && values.participants.length === 0 ? null : (
                  <T4Section
                    title="Coechipieri"
                    icon={<UserIcon />}
                    description={!locked && competition.teamParticipants ? teamLimitCaption(competition.teamParticipants) : undefined}
                  >
                    {locked ? null : (
                      <Button
                        type="button"
                        variant="outline"
                        icon={<PlusIcon />}
                        onClick={() => setPickerOpen(true)}
                        disabled={!addAllowed || busy}
                        className="self-start max-md:w-full"
                        data-testid="add-teammates"
                      >
                        Adaugă coechipieri
                      </Button>
                    )}
                    {values.participants.length > 0 ? (
                      <ul
                        aria-label={locked ? 'Coechipieri' : 'Coechipieri adăugați'}
                        className="flex flex-col gap-2"
                        data-testid="teammates"
                      >
                        {values.participants.map(p =>
                          locked ? (
                            <li key={p.documentId} className="flex min-h-11 items-center gap-3 rounded-control border border-hairline px-3">
                              <UserIcon aria-hidden className="size-5 shrink-0 text-muted" />
                              <span className="t-body min-w-0 flex-1 truncate text-ink-2">{p.username}</span>
                            </li>
                          ) : (
                            <li
                              key={p.documentId}
                              className="flex min-h-12 items-center gap-2 rounded-control bg-accent-tint py-1 pr-1 pl-4"
                            >
                              <span className="t-body min-w-0 flex-1 truncate text-accent-ink">{p.username}</span>
                              <button
                                type="button"
                                onClick={() => removeTeammate(p.documentId)}
                                aria-label={`Elimină pe ${p.username}`}
                                className="flex size-10 shrink-0 items-center justify-center rounded-control text-status-danger-fg hover:bg-status-danger-bg focus-visible:outline-2 focus-visible:outline-accent"
                              >
                                <XMarkIcon aria-hidden className="size-5" />
                              </button>
                            </li>
                          ),
                        )}
                      </ul>
                    ) : null}
                  </T4Section>
                )}
              </>
            ) : null}
          </form>
        </TwoColumns>
      </T4Frame>

      <TeammatePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        t={t}
        taken={taken}
        anchor={pickerAnchor}
        onPick={addTeammate}
      />
      <EmptyTeamConfirm
        open={confirmEmpty}
        onCancel={() => setConfirmEmpty(false)}
        onConfirm={() => {
          setConfirmEmpty(false);
          write();
        }}
      />
      <Dialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        alert
        title="Ești sigur că dorești să părăsești concursul?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmLeave(false)}>
              Închide
            </Button>
            <Button variant="danger" onClick={leaveCompetition} data-testid="leave-confirm">
              Părăsește concursul
            </Button>
          </>
        }
      />
      <StatusDialog state={status} onClose={() => setStatus(null)} onDone={goToCompetition} />
      {leaveGuardDialog}
    </>
  );
}

/* ============================================================================================== */
/* Footer                                                                                         */
/* ============================================================================================== */

type FooterProps = {
  footer: Footer;
  dirty: boolean;
  busy: boolean;
  onLeave: () => void;
};

/** The submit CTA (both copies submit the one form). */
function Primary({ footer, dirty, busy }: FooterProps) {
  const label = footer.kind === 'create' ? 'Finalizează' : 'Salvează modificările';
  return (
    <Button
      type="submit"
      form={FORM_ID}
      block
      disabled={(footer.kind === 'update' && !dirty) || busy}
      aria-busy={busy || undefined}
      icon={busy ? <T4Spinner /> : undefined}
      data-testid="registration-submit"
    >
      {label}
    </Button>
  );
}

function Leave({ busy, onLeave }: FooterProps) {
  return (
    <Button type="button" variant="danger" block onClick={onLeave} disabled={busy} data-testid="registration-leave">
      Părăsește concursul
    </Button>
  );
}

function Locked({ footer }: { footer: Extract<Footer, { kind: 'locked' }> }) {
  return (
    <p className="t-body-strong py-1 text-center text-ink-2" data-testid="registration-locked">
      {footer.message}
    </p>
  );
}

/** Below 1024: fish's footer, in the T4 action bar pinned to the viewport's bottom edge. */
function BarActions(props: FooterProps) {
  const { footer } = props;
  if (footer.kind === 'locked') return <T4ActionBar className="lg:hidden" primary={<Locked footer={footer} />} />;
  return (
    <T4ActionBar
      className="lg:hidden"
      primary={<Primary {...props} />}
      secondary={footer.kind === 'update' && footer.canLeave ? <Leave {...props} /> : undefined}
    />
  );
}

/** From 1024: the same actions under the summary card. */
function FooterActions(props: FooterProps) {
  const { footer } = props;
  if (footer.kind === 'locked') return <Locked footer={footer} />;
  return (
    <>
      <Primary {...props} />
      {footer.kind === 'update' && footer.canLeave ? <Leave {...props} /> : null}
    </>
  );
}

/* ============================================================================================== */
/* Layout pieces                                                                                  */
/* ============================================================================================== */

/**
 * Phone / tablet: one column. From 1024: the form (fluid, it fills the shell's column like every T4
 * form track) and the sticky summary column (320, 360 from 1440 — the template tracks) side by side,
 * so the page ends on the shell's right gutter at every width; the summary column sits under the sticky header below 1280 (the header scrolls
 * away from 1280).
 */
function TwoColumns({ children, aside }: { children: ReactNode; aside: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_--spacing(80)] lg:items-start lg:gap-6 2xl:grid-cols-[minmax(0,1fr)_--spacing(90)]">
      <div className="flex min-w-0 flex-col gap-4 md:gap-5">{children}</div>
      <aside aria-label="Rezumat" className="hidden lg:sticky lg:top-44 lg:flex lg:flex-col lg:gap-4 xl:top-24">
        {aside}
      </aside>
    </div>
  );
}

function PageState({ back, eyebrow, children }: { back: T4Back; eyebrow?: string; children: ReactNode }) {
  return (
    <T4Frame pageState label="Înscriere" header={<T4Header title="Înscriere" eyebrow={eyebrow} back={back} />}>
      {children}
    </T4Frame>
  );
}

/**
 * The competition being joined. `compact` (below 1024, above the form): thumb, name, the format
 * and the dates on one card row. Otherwise (the summary column from 1024): the picture 16:9, the
 * name (a link back), the lake, then the facts — dates, format, the registration deadline.
 */
function CompetitionSummary({
  competition: c,
  compact = false,
  children,
}: {
  competition: CompetitionWithMyStatus;
  compact?: boolean;
  /** The card's footer (from 1024: the form's actions, Airbnb's reserve card). */
  children?: ReactNode;
}) {
  const dates = competitionDateProse(c.startDate, displayEnd(c));
  const format = formatLine(c.competitionType, c.teamParticipants);
  const deadline = c.registrationDeadline ? competitionDateTime(c.registrationDeadline) : '';
  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-card bg-surface p-3 shadow-e0 lg:hidden" data-testid="registration-summary-compact">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={competitionThumb(c)}
          alt=""
          className="size-14 shrink-0 rounded-control bg-soft-fill object-cover"
          loading="lazy"
          decoding="async"
        />
        <div className="min-w-0 flex-1">
          <p className="t-body-strong truncate text-ink">{c.name}</p>
          <p className="t-caption truncate text-muted">{[format, dates].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
    );
  }
  // The site's competition placeholder when there is no banner (the header's thumb does the same).
  const poster = c.banner?.formats.medium?.url ?? c.banner?.formats.small?.url ?? c.banner?.url ?? '/images/competition-placeholder.jpg';
  // Only what the competition has (rule 4): no «—» rows on this summary.
  const rows: T4Row[] = [
    ...(dates ? [{ label: 'Data', value: dates }] : []),
    ...(format ? [{ label: 'Format', value: format }] : []),
    ...(deadline ? [{ label: 'Înscrieri până la', value: deadline }] : []),
  ];
  return (
    <div data-testid="registration-summary">
      <T4Summary
        title="Te înscrii la"
        header={
          <div className="flex flex-col gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={poster}
              alt=""
              className="aspect-video w-full rounded-control bg-soft-fill object-cover"
              loading="lazy"
              decoding="async"
            />
            <div className="flex flex-col gap-0.5">
              <p className="t-title2 text-ink">
                <Link
                  href={routes.competition(c.documentId)}
                  className="rounded-control hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {c.name}
                </Link>
              </p>
              {c.lake?.name ? <p className="t-body text-muted">{c.lake.name}</p> : null}
            </div>
          </div>
        }
        rows={rows}
      >
        {children ? <div className="flex flex-col gap-2.5 border-t border-hairline pt-4">{children}</div> : null}
      </T4Summary>
    </div>
  );
}

/**
 * A value the user cannot change here (the username, the profile's phone, a locked team name): no
 * fill, a hairline, the muted value and a lock — never the editable field's look. Still a real
 * read-only input, so it is labelled, selectable and read by AT as such.
 */
function ReadOnlyField({
  id,
  label,
  value,
  helper,
  'data-testid': testId,
}: {
  id?: string;
  label: string;
  value: string;
  helper?: string;
  'data-testid'?: string;
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <Field label={label} helper={helper} htmlFor={inputId} helperId={`${inputId}-help`}>
      <div className="flex h-11 items-center gap-2 rounded-control border border-hairline px-3">
        <input
          id={inputId}
          value={value}
          readOnly
          aria-readonly
          aria-describedby={helper ? `${inputId}-help` : undefined}
          className="t-body h-full min-w-0 flex-1 cursor-default bg-transparent text-ink-2 outline-none focus-visible:outline-none"
          data-testid={testId}
        />
        <LockClosedIcon aria-hidden className="size-4 shrink-0 text-muted" />
      </div>
    </Field>
  );
}

/* ============================================================================================== */
/* Signed out (c2) and loading (c1)                                                               */
/* ============================================================================================== */

/**
 * c2 — fish's signed-out screen: the fisherman, «Înscrie-te la competiție», the text and «Intră în
 * cont» (back here after sign-in). Reached with a session cookie the CMS refused; a visitor with no
 * cookie at all was sent to /intra by the proxy before the page rendered.
 */
function SignedOutGate({ competitionId, next }: { competitionId: string; next: string }) {
  return (
    <>
      <SetBreadcrumb trail={[COMPETITIONS_CRUMB, { label: 'Înscriere' }]} />
      <T4Frame
        pageState
        label="Înscriere"
        header={
          <T4Header
            title="Înscriere"
            back={{
              label: 'Înapoi la concurs',
              href: routes.competition(competitionId),
            }}
          />
        }
      >
        <div
          className={cn(
            STATE_CARD_FRAME,
            'flex flex-col items-center gap-3 rounded-card bg-surface px-5 py-8 text-center shadow-e0 md:px-8 md:py-12',
          )}
          data-testid="registration-signed-out"
        >
          <FishermanArt className="mb-1 max-w-70" />
          <h2 className="t-title2 text-ink">Înscrie-te la competiție</h2>
          <p className="t-body max-w-100 text-ink-2">
            Autentifică-te pentru a putea participa la competiție. După ce te conectezi, revino aici pentru a-ți finaliza înscrierea.
          </p>
          <ButtonLink href={routes.signIn(next)} className="mt-2 w-full max-w-70">
            Intră în cont
          </ButtonLink>
        </div>
      </T4Frame>
    </>
  );
}

/**
 * c1 — the page while the competition and the profile load: the real header, the two field cards,
 * the bar's CTA (disabled) and, from 1024, the summary column's shape. One status line for AT.
 */
export function RegistrationSkeleton({ back, eyebrow }: { back?: T4Back; eyebrow?: string }) {
  return (
    <>
      <p role="status" className="sr-only">
        Se încarcă înscrierea…
      </p>
      <T4Frame
        busy
        label="Înscriere"
        header={<T4Header title="Înscriere" eyebrow={eyebrow ?? <T4LineBar type="t-eyebrow" className="w-40" />} back={back} />}
        actions={
          <T4ActionBar
            className="lg:hidden"
            primary={
              <Button block disabled>
                Finalizează
              </Button>
            }
          />
        }
      >
        <div data-testid="registration-skeleton" className="contents">
          <TwoColumns
            aside={
              <div aria-hidden className="flex flex-col overflow-hidden rounded-card bg-surface shadow-e0">
                <span className="aspect-video w-full animate-shimmer" />
                <span className="flex flex-col gap-2.5 p-6">
                  <T4LineBar type="t-eyebrow" className="w-24" />
                  <T4LineBar type="t-title2" className="w-48" />
                  <T4LineBar type="t-body" className="w-32" />
                </span>
              </div>
            }
          >
            <div aria-hidden className="flex items-center gap-3 rounded-card bg-surface p-3 shadow-e0 lg:hidden">
              <span className="size-14 shrink-0 animate-shimmer rounded-control" />
              <span className="flex min-w-0 flex-1 flex-col">
                <T4LineBar type="t-body-strong" className="w-40" />
                <T4LineBar type="t-caption" className="w-56 max-w-full" />
              </span>
            </div>
            <T4SectionSkeleton fields={2} columns={2} />
          </TwoColumns>
        </div>
      </T4Frame>
    </>
  );
}
