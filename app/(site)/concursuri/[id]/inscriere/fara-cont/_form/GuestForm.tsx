'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExclamationTriangleIcon, PlusIcon, TrophyIcon, UserGroupIcon, UserIcon, XMarkIcon } from '@heroicons/react/24/outline';
import {
  CDN_PURGE_SETTLE_MS,
  competitionQuery,
  competitionsKeys,
  registrationGuestMutation,
  updateRegistrationGuestMutation,
  userStatuteForCompetitionQuery,
  type CompetitionWithMyStatus,
  type DetailRegistration,
} from '@/core/competitions';
import { isApiError } from '@/core/transport';
import { useLeaveGuard } from '@/components/account/profile-form/useLeaveGuard';
import { TextInput } from '@/components/forms/TextInput';
import {
  T4ActionBar,
  T4ErrorSummary,
  T4Frame,
  T4Gate,
  T4Header,
  T4LineBar,
  T4Section,
  T4SectionSkeleton,
  T4Spinner,
  T4Summary,
  type T4Back,
  type T4FieldError,
  type T4Row,
} from '@/components/templates/T4';
import { Button, ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../../../_shell/SiteHeader';
import { useSiteToast } from '../../../../../_shell/Toast';
import { COMPETITIONS_CRUMB } from '../../../_components/crumbs';
import { competitionDateProse, displayEnd } from '../../../_components/dates';
import { competitionThumb } from '../../../_components/headerMeta';
import { RULE_CARD } from '../../echipa/_components/layout';
import { formatLine } from '../../_form/model';
import {
  ADDED,
  buildPayload,
  canAddName,
  capacityLine,
  effectiveMembersOnly,
  findGuestRegistration,
  hasErrors,
  isDirty,
  NO_PARTICIPANT,
  sanitizeName,
  seedValues,
  teamMaxCaption,
  UPDATED,
  validate,
  writeErrorMessage,
  type GuestValues,
} from './model';

/*
 * Adaugă / Editează participanți fără cont — fish app/(app)/register/register-guests.tsx (parity
 * participant.register-guests c1–c14), on T4 (one step). The page (../page.tsx) only settles the
 * session; the competition (its type, team size, registrations) and the viewer's statute are read
 * here through /api/cms.
 *  - c1 loading → the skeleton; a failed read → the error state with a retry that refetches;
 *  - organizer only: a statute other than «author» goes back to the competition page;
 *  - c2–c7 the title, the notice, the fields; c8 edit seeding from the registration; c9–c13 writes;
 *  - c14 unsaved changes: the site's leave dialog (useLeaveGuard, as participant.register c20).
 * Rule 4 — never a form the CMS would refuse: adding after the start or with the competition full,
 * editing a finished one, or a link to an entry that is gone, each say so instead.
 * Layout as /inscriere: phone, one column and the action bar pinned to the bottom edge; from 1024
 * the form column and a sticky summary card (the competition, its places) with the CTA under it.
 */

const FORM_ID = 'fara-cont-form';
const TITLE_ID = 'fara-cont-titlu';
const TEAM_ID = 'fara-cont-echipa';
const nameId = (i: number) => `fara-cont-pescar-${i}`;

type Props = {
  competitionId: string;
  /** ?inscriere= — the guest registration edited (edit mode). */
  registrationId: string | null;
  /** ?doarEchipa=1 — only the team name (fish membersOnly). */
  membersOnly: boolean;
};

const titleOf = (registrationId: string | null) => (registrationId ? 'Editează participanți' : 'Adaugă participanți fără cont');

/* ============================================================================================== */
/* Data                                                                                           */
/* ============================================================================================== */

export function GuestScreen({ competitionId, registrationId, membersOnly }: Props) {
  const t = useMemo(() => createBrowserTransport(), []);
  const router = useRouter();
  const session = { isAuthenticated: true };
  const competition = useQuery(competitionQuery(t, competitionId, session));
  const statute = useQuery(userStatuteForCompetitionQuery(t, competitionId, session));
  const title = titleOf(registrationId);
  // Once the form is on screen a write's refetch (or a statute refresh) never swaps it for a state.
  const [formShown, setFormShown] = useState(false);

  const back: T4Back = registrationId
    ? { label: 'Înapoi la participanți', href: routes.competitionParticipants(competitionId) }
    : { label: 'Înapoi la concurs', href: routes.competition(competitionId) };
  const name = competition.data?.name;
  const crumbs = (
    <SetBreadcrumb
      trail={[COMPETITIONS_CRUMB, ...(name ? [{ label: name, href: routes.competition(competitionId) }] : []), { label: 'Participanți fără cont' }]}
    />
  );

  const notAuthor = statute.isSuccess && statute.data.userRole !== 'author' && !formShown;
  useEffect(() => {
    if (notAuthor) router.replace(routes.competition(competitionId));
  }, [notAuthor, router, competitionId]);

  if (!formShown && (competition.isPending || statute.isPending || notAuthor)) {
    return (
      <>
        {crumbs}
        <GuestSkeleton back={back} eyebrow={name} title={title} />
      </>
    );
  }

  if (!formShown && (competition.isError || statute.isError)) {
    const missing = competition.isError && isApiError(competition.error) && competition.error.status === 404;
    const retrying = competition.isFetching || statute.isFetching;
    return (
      <>
        {crumbs}
        <PageState back={back} title={title}>
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
                    if (statute.isError) void statute.refetch();
                  }}
                  disabled={retrying}
                  aria-busy={retrying || undefined}
                  data-testid="guests-retry"
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

  const c = competition.data;
  if (!c) return null;
  // doarEchipa: a team entry only (model effectiveMembersOnly); a single one is the normal edit.
  const teamOnly = effectiveMembersOnly(membersOnly, { isTeam: c.competitionType === 'team' });

  let registration: DetailRegistration | null = null;
  if (registrationId) {
    const found = findGuestRegistration(c.registrations, registrationId);
    if (found.kind !== 'found' && !formShown) {
      return (
        <>
          {crumbs}
          <PageState back={back} title={title} eyebrow={name}>
            {found.kind === 'missing' ? (
              <T4Gate
                icon={<UserGroupIcon />}
                title="Înscrierea nu a fost găsită"
                description="Poate a fost retrasă sau ștearsă între timp."
                actions={<ButtonLink href={routes.competitionParticipants(competitionId)}>Vezi participanții</ButtonLink>}
              />
            ) : (
              <T4Gate
                icon={<UserGroupIcon />}
                title="Înscrierea are participanți cu cont"
                description="Numele lor vin din conturile Bluvi. Poți modifica înscrierea din pagina de înscriere, ca organizator."
                actions={
                  <ButtonLink href={routes.competitionRegister(competitionId, { organizator: true, inscriere: registrationId })}>
                    Editează înscrierea
                  </ButtonLink>
                }
              />
            )}
          </PageState>
        </>
      );
    }
    if (found.kind === 'found') registration = found.registration;
  }

  // Rule 4: the CMS refuses these writes (registerGuests: notStarted and a free place; updateGuest:
  // not completed / cancelled) — say so instead of a form that cannot be saved.
  const closed = formShown ? null : unavailableReason(c, registrationId);
  if (closed) {
    return (
      <>
        {crumbs}
        <PageState back={back} title={title} eyebrow={name}>
          <div className="contents" data-testid="guests-unavailable">
            <T4Gate
              icon={<TrophyIcon />}
              title={closed.title}
              description={closed.description}
              actions={<ButtonLink href={routes.competitionParticipants(competitionId)}>Vezi participanții</ButtonLink>}
            />
          </div>
        </PageState>
      </>
    );
  }

  return (
    <>
      {crumbs}
      <GuestForm
        t={t}
        competition={c}
        registration={registration}
        registrationId={registrationId}
        membersOnly={teamOnly}
        back={back}
        onShown={setFormShown}
      />
    </>
  );
}

function unavailableReason(c: CompetitionWithMyStatus, registrationId: string | null): { title: string; description: string } | null {
  if (registrationId) {
    if (c.competitionStatus === 'completed' || c.competitionStatus === 'cancelled')
      return {
        title: 'Înscrierile nu mai pot fi modificate',
        description: 'Înscrierile nu mai pot fi modificate după încheierea competiției.',
      };
    return null;
  }
  if (c.competitionStatus !== 'notStarted')
    return {
      title: 'Nu mai poți adăuga participanți',
      description: 'Participanții fără cont pot fi adăugați doar înainte de începerea concursului.',
    };
  const approved = c.registrations.filter(r => r.registrationStatus === 'registered').length;
  if (c.participantsLimit != null && c.participantsLimit - approved < 1)
    return {
      title: 'Concursul este complet',
      description: 'Concursul a atins numărul maxim de participanți.',
    };
  return null;
}

/* ============================================================================================== */
/* The form                                                                                       */
/* ============================================================================================== */

function GuestForm({
  t,
  competition,
  registration,
  registrationId,
  membersOnly,
  back,
  onShown,
}: {
  t: ReturnType<typeof createBrowserTransport>;
  competition: CompetitionWithMyStatus;
  registration: DetailRegistration | null;
  registrationId: string | null;
  membersOnly: boolean;
  back: T4Back;
  onShown: (shown: true) => void;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useSiteToast();
  const competitionId = competition.documentId;
  const isTeam = competition.competitionType === 'team';
  const isEdit = Boolean(registrationId);
  const title = titleOf(registrationId);
  useEffect(() => onShown(true), [onShown]);

  const [values, setValues] = useState<GuestValues>(() => seedValues(registration, { isTeam }));
  const [baseline] = useState<GuestValues>(values);
  // Stable keys for the «Participant {n}» rows (a removed row takes its own input with it).
  const nextKey = useRef(values.names.length);
  const [keys, setKeys] = useState<number[]>(() => values.names.map((_, i) => i));
  const dirty = isDirty(values, baseline);

  const [submitted, setSubmitted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  /** A write succeeded: the guard stands down, then the page goes back (effect below). */
  const [finished, setFinished] = useState(false);

  const create = useMutation(registrationGuestMutation(t, qc));
  const update = useMutation(updateRegistrationGuestMutation(t, qc));
  const busy = create.isPending || update.isPending;

  const { dialog: leaveGuardDialog } = useLeaveGuard(dirty && !finished && !busy);

  // fish router.back() — after the guard has been torn down (this effect runs after its cleanup).
  // Only back inside the site (the Navigation API's canGoBack counts same-origin entries); opened
  // straight from a link, a new tab or another site: the competition's participants instead.
  useEffect(() => {
    if (!finished) return;
    const nav = (window as unknown as { navigation?: { canGoBack: boolean } }).navigation;
    if (nav ? nav.canGoBack : window.history.length > 1) router.back();
    else router.replace(routes.competitionParticipants(competitionId));
  }, [finished, router, competitionId]);

  const mode = { isTeam, membersOnly };
  const errors = submitted ? validate(values, mode) : { names: {} as Record<number, string> };
  const summaryErrors: T4FieldError[] = [
    ...(membersOnly
      ? []
      : values.names.flatMap((_, i) =>
          errors.names[i] ? [{ id: nameId(i), label: isTeam ? `Participant ${i + 1}` : 'Pescar', message: errors.names[i] }] : [],
        )),
    ...(errors.teamName ? [{ id: TEAM_ID, label: 'Numele echipei', message: errors.teamName }] : []),
  ];

  const setName = (i: number, raw: string) => setValues(v => ({ ...v, names: v.names.map((n, j) => (j === i ? sanitizeName(raw) : n)) }));

  const focusAfter = useRef<string | null>(null);
  useEffect(() => {
    if (!focusAfter.current) return;
    document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  });

  const addName = () => {
    focusAfter.current = nameId(values.names.length);
    setValues(v => ({ ...v, names: [...v.names, ''] }));
    setKeys(k => [...k, nextKey.current++]);
  };
  const removeName = (i: number) => {
    // Focus stays in the list: the row that takes this place, else the one before.
    focusAfter.current = nameId(Math.min(i, values.names.length - 2));
    setValues(v => ({ ...v, names: v.names.filter((_, j) => j !== i) }));
    setKeys(k => k.filter((_, j) => j !== i));
  };

  /**
   * After the write the competition is edge cached and purged ~0.65 s later: the mutation's own
   * invalidation may store the pre-write copy, so the competition is read again once the purge has
   * landed (as /inscriere does).
   */
  const refetchAfterPurge = () => {
    const key = competitionsKeys.byId(competitionId);
    window.setTimeout(() => void qc.invalidateQueries({ queryKey: key, exact: true }), CDN_PURGE_SETTLE_MS);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy || finished) return;
    setSubmitted(true);
    setAttempt(a => a + 1);
    if (hasErrors(validate(values, mode))) return;
    const built = buildPayload(values, { competitionId, registrationId, ...mode });
    if (built.kind === 'empty') {
      toast(NO_PARTICIPANT, 'danger');
      return;
    }
    const done = (message: string) => {
      refetchAfterPurge();
      toast(message, 'success');
      setFinished(true);
    };
    const failed = (error: unknown) => toast(writeErrorMessage(error), 'danger');
    if (built.kind === 'create') create.mutate(built.payload, { onSuccess: () => done(ADDED), onError: failed });
    else update.mutate(built.payload, { onSuccess: () => done(UPDATED), onError: failed });
  };

  const submitLabel = isEdit ? 'Salvează' : 'Finalizează';
  const primary = (
    <Button
      type="submit"
      form={FORM_ID}
      block
      disabled={busy || finished}
      aria-busy={busy || undefined}
      icon={busy ? <T4Spinner /> : undefined}
      data-testid="guests-submit"
    >
      {submitLabel}
    </Button>
  );

  return (
    <>
      <T4Frame
        label={title}
        header={<T4Header title={title} titleId={TITLE_ID} eyebrow={competition.name} back={back} busy={busy} />}
        actions={<T4ActionBar className="lg:hidden" primary={primary} />}
      >
        <TwoColumns
          aside={
            <CompetitionSummary competition={competition} title={isEdit ? 'Concursul' : 'Adaugi la'}>
              <div className="flex flex-col gap-2.5" data-testid="guests-actions-desktop">
                {primary}
              </div>
            </CompetitionSummary>
          }
        >
          <CompetitionSummary competition={competition} compact />
          {isEdit ? null : <Notice isTeam={isTeam} />}
          <T4ErrorSummary errors={summaryErrors} attempt={attempt} />
          <form id={FORM_ID} noValidate onSubmit={submit} aria-labelledby={TITLE_ID} className="flex flex-col gap-4 md:gap-5">
            {membersOnly ? null : isTeam ? (
              <T4Section
                title="Participanți"
                icon={<UserGroupIcon />}
                description={competition.teamParticipants ? teamMaxCaption(competition.teamParticipants) : undefined}
              >
                {/* Two members per row from 768: the card uses its width instead of 1000px-long single inputs. */}
                <ul className="grid gap-3 md:grid-cols-2 md:gap-x-5" aria-label="Participanți" data-testid="guest-names">
                  {values.names.map((value, i) => (
                    <li key={keys[i]} className="flex items-start gap-2">
                      <TextInput
                        id={nameId(i)}
                        label={`Participant ${i + 1}`}
                        placeholder="Introdu numele pescarului"
                        autoComplete="off"
                        value={value}
                        onChange={e => setName(i, e.currentTarget.value)}
                        aria-required
                        error={errors.names[i]}
                        className="min-w-0 flex-1"
                      />
                      {values.names.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeName(i)}
                          disabled={busy}
                          aria-label={`Elimină participantul ${i + 1}`}
                          // Level with the input: under the label line (fish marginTop 32).
                          className="mt-7 flex size-11 shrink-0 items-center justify-center rounded-control text-status-danger-fg hover:bg-status-danger-bg focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
                        >
                          <XMarkIcon aria-hidden className="size-5" />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {canAddName(values.names.length, competition.teamParticipants) ? (
                  <Button
                    type="button"
                    variant="outline"
                    icon={<PlusIcon />}
                    onClick={addName}
                    disabled={busy}
                    className="self-start max-md:w-full"
                    data-testid="guest-add"
                  >
                    Adaugă participant
                  </Button>
                ) : null}
              </T4Section>
            ) : (
              <T4Section title="Participant" icon={<UserIcon />}>
                <TextInput
                  id={nameId(0)}
                  label="Pescar"
                  placeholder="Introdu numele pescarului"
                  helper="Poți scrie numele pescarului așa cum vrei să apară în clasament"
                  autoComplete="off"
                  value={values.names[0] ?? ''}
                  onChange={e => setName(0, e.currentTarget.value)}
                  aria-required
                  error={errors.names[0]}
                />
              </T4Section>
            )}
            {isTeam ? (
              <T4Section
                title="Echipa"
                icon={<TrophyIcon />}
                // doarEchipa: the members stay as they are — named here so the organizer knows which entry this is.
                description={membersOnly && registration?.guestName ? registration.guestName : undefined}
              >
                <TextInput
                  id={TEAM_ID}
                  label="Numele echipei"
                  placeholder="Introdu numele echipei"
                  helper="Numele echipei este opțional"
                  autoComplete="off"
                  value={values.teamName}
                  onChange={e => {
                    const teamName = sanitizeName(e.currentTarget.value);
                    setValues(v => ({ ...v, teamName }));
                  }}
                  error={errors.teamName}
                />
              </T4Section>
            ) : null}
          </form>
        </TwoColumns>
      </T4Frame>
      {leaveGuardDialog}
    </>
  );
}

/**
 * c3 — fish's DisclaimerItem «⚠️ Observații importante» (add mode): the rules card of the team
 * disclaimer (2px accent outline), «Aprobat» in the success colour and «Elimină» in the danger one.
 */
function Notice({ isTeam }: { isTeam: boolean }) {
  return (
    <section aria-labelledby="fara-cont-observatii" className={cn(RULE_CARD, 'gap-3')} data-testid="guests-notice">
      <h2 id="fara-cont-observatii" className="t-heading text-ink">
        <span aria-hidden>⚠️ </span>Observații importante
      </h2>
      <ol className="t-body flex max-w-180 list-decimal flex-col gap-2.5 pl-5 text-ink-2 marker:text-muted">
        <li>
          {isTeam ? 'Echipa adăugată' : 'Pescarul adăugat'} aici va fi înregistrat{isTeam ? 'ă' : ''} automat cu statusul{' '}
          <strong className="font-semibold text-status-success-fg">„Aprobat”</strong> în lista de participanți.
        </li>
        <li>
          Dacă {isTeam ? 'un membru al echipei' : 'pescarul'} dorește să participe folosind contul personal Bluvi®, poți folosi butonul{' '}
          <strong className="font-semibold text-status-danger-fg">„Elimină”</strong> din pagina de participanți pentru a elimina{' '}
          {isTeam ? 'echipa' : 'participantul'} adăugat{isTeam ? 'ă' : ''} manual înainte să înceapă concursul.
        </li>
      </ol>
    </section>
  );
}

/* ============================================================================================== */
/* Layout pieces                                                                                  */
/* ============================================================================================== */

/**
 * As /inscriere: one column below 1024; from 1024 the form (fluid — the page uses the shell's width,
 * owner 2026-10-04; only the notice's reading text is capped) and the sticky summary column.
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

function PageState({ back, title, eyebrow, children }: { back: T4Back; title: string; eyebrow?: string; children: ReactNode }) {
  return (
    <T4Frame pageState label={title} header={<T4Header title={title} eyebrow={eyebrow} back={back} />}>
      {children}
    </T4Frame>
  );
}

/**
 * The competition the entries go to. `compact` (below 1024, above the form): thumb, name, format
 * and dates on one row. Otherwise (the summary column): the picture, the name (a link back), the
 * lake, then dates, format and the places taken — only what the competition has (rule 4).
 */
function CompetitionSummary({
  competition: c,
  compact = false,
  title = 'Adaugi la',
  children,
}: {
  competition: CompetitionWithMyStatus;
  compact?: boolean;
  title?: string;
  children?: ReactNode;
}) {
  const dates = competitionDateProse(c.startDate, displayEnd(c));
  const format = formatLine(c.competitionType, c.teamParticipants);
  const places = capacityLine(c.registrations, c.participantsLimit);
  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-card bg-surface p-3 shadow-e0 lg:hidden" data-testid="guests-summary-compact">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={competitionThumb(c)} alt="" className="size-14 shrink-0 rounded-control bg-soft-fill object-cover" loading="lazy" decoding="async" />
        <div className="min-w-0 flex-1">
          <p className="t-body-strong truncate text-ink">{c.name}</p>
          <p className="t-caption truncate text-muted">{[format, dates, places ? `${places} locuri ocupate` : null].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
    );
  }
  const poster = c.banner?.formats.medium?.url ?? c.banner?.formats.small?.url ?? c.banner?.url ?? '/images/competition-placeholder.jpg';
  const rows: T4Row[] = [
    ...(dates ? [{ label: 'Data', value: dates }] : []),
    ...(format ? [{ label: 'Format', value: format }] : []),
    ...(places ? [{ label: 'Locuri ocupate', value: places }] : []),
  ];
  return (
    <div data-testid="guests-summary">
      <T4Summary
        title={title}
        header={
          <div className="flex flex-col gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={poster} alt="" className="aspect-video w-full rounded-control bg-soft-fill object-cover" loading="lazy" decoding="async" />
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

/* ============================================================================================== */
/* Loading (c1)                                                                                   */
/* ============================================================================================== */

/** c1 — the real header, one field card, the bar's CTA (disabled) and the summary column's shape. */
export function GuestSkeleton({ back, eyebrow, title = 'Participanți fără cont' }: { back?: T4Back; eyebrow?: string; title?: string }) {
  return (
    <>
      <p role="status" className="sr-only">
        Se încarcă formularul…
      </p>
      <T4Frame
        busy
        label={title}
        header={<T4Header title={title} eyebrow={eyebrow ?? <T4LineBar type="t-eyebrow" className="w-40" />} back={back} />}
        actions={
          <T4ActionBar
            className="lg:hidden"
            primary={
              <Button block disabled>
                Se încarcă…
              </Button>
            }
          />
        }
      >
        <div data-testid="guests-skeleton" className="contents">
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
            <T4SectionSkeleton fields={2} columns={1} />
          </TwoColumns>
        </div>
      </T4Frame>
    </>
  );
}
