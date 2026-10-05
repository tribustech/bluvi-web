import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { formatDecimal, plural } from '@/components/cards/format';
import { ScaleIcon } from '@/components/icons/brand';
import { T4Gate, T4Notice } from '@/components/templates/T4';
import { FlowAsideCard, FlowHeader, FlowLayout } from '@/components/templates/T6';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { SignatureNumber } from '@/components/ui/SignatureNumber';
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill';
import { routes } from '@/lib/routes';
import { getSessionToken } from '@/lib/server/session';
import { AddCatchFlow } from './AddCatchFlow';
import {
  createDeadline,
  loadAddCatch,
  loadScale,
  startAddCatchReads,
  type AddCatchData,
  type Deadline,
  type ScaleAccess,
  type ScaleData,
  type StandView,
} from './data';
import { DemoErrorBoundary } from './DemoErrorBoundary';
import { AddCatchSkeleton, GateSkeleton, LoadingFallback, LoadingFlow, LoadingNeutral } from './LoadingFallback';
import { RetryButton } from './RetryButton';
import { StandPicker } from './StandPicker';
import { StandSubject } from './StandSubject';
import SiteLayout from '../../../(site)/layout';
import { SetBreadcrumb } from '../../../(site)/_shell/SiteHeader';
import { PREVIEW_STATES, READ_ONLY_TITLE, STATES, STEP2_STATES, isStepTwo, type DemoState } from './states';
import { StateSwitcher, StateSwitcherView } from './StateSwitcher';

/*
 * T6 «Single-task flow» demo (ROADMAP §4) on its first user screen, the scale (fish
 * app/(app)/scale/[competitionId]/*): step 1 «Alege standul», step 2 «Adaugă captură», and the
 * confirmation. Real data from the local CMS through core/; nothing is written.
 *
 * ?state=signed-out|empty|loading|loading-add|slow|error|nc|weighed|add|invalid|confirmed|readonly
 * — every state (`slow`: a CMS that never answers, skeleton → the page's 8 s deadline → error).
 * ?competition=<documentId>&stand=<documentId> — any competition / stand, with the viewer's real
 * access (a stand opened from step 1 is read-only when the scale is closed for the viewer).
 * `add`, `invalid` and `confirmed` preview the open scale whatever the viewer's role (the local
 * fixtures have no started competition the QA user weighs) — for a signed-in viewer only: the
 * sign-in gate always wins; `readonly` shows step 2 closed.
 * Dev only: 404 in production builds (as /dev/kit).
 */

export const metadata: Metadata = { title: 'T6 · Flux cu o singură sarcină', robots: { index: false } };

/** Local CMS fixtures: the QA user (sim-qa) is the author of SIM3 (team, not started, Chita Lake). */
const COMPETITION: Record<string, string> = {
  default: 'a6xjl65ooe9eadrtvvqj9hn1', // SIM3 Cupa C&B Ed 8 — echipe, 4 × 5 standuri
  empty: 'uql25w776iris1wqnsc20wyg', // [AUDIT27] Start maine — sectoare fără standuri
  nc: 'z7rvhm55ziyr0tbblqwjp39q', // CN Test — campionat național, cluburi, 3 libere
  weighed: 'i8kzbi5k51vmbyq75dmyez3d', // Andrew 1 — individual, cântăriri pe fiecare stand
};

const BASE = '/dev/templates/t6';

type Search = { state?: string; competition?: string; stand?: string };

export default function T6DemoPage({ searchParams }: { searchParams: Promise<Search> }) {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_KIT !== '1') notFound();
  // The real app shell (top bar, breadcrumbs, skip link, toasts) around the demo, so the
  // screenshots show the template where it will live. Rendered here rather than as a layout.tsx:
  // a new layout route trips the stale .next/types of an older build in `tsc`.
  // The breadcrumb and the demo switcher need no CMS read: they render outside the data boundary,
  // so the loading fallback has the same chrome above it as the loaded page.
  return (
    <SiteLayout>
      <SetBreadcrumb trail={[{ label: 'Șabloane' }, { label: 'T6 · Cântar' }]} />
      <Suspense fallback={<StateSwitcherView />}>
        <StateSwitcher />
      </Suspense>
      {/* The static shell holds the step-neutral skeleton (the URL is not known yet); on the
          client the URL picks step 1's or step 2's (LoadingFallback). */}
      <Suspense
        fallback={
          <Suspense fallback={<LoadingNeutral />}>
            <LoadingFallback />
          </Suspense>
        }
      >
        <KeyedDemo searchParams={searchParams} />
      </Suspense>
    </SiteLayout>
  );
}

/**
 * Reads the URL (fast: no CMS) so the data boundary can be keyed by it: a new stand, competition
 * or demo state mounts a fresh boundary, whose skeleton shows at once — the router never holds the
 * previous page on screen while a slow CMS answers (a tap that looks dead invites another). The
 * skeleton is picked here, on the server: the step from the URL, the gate's shape when there is no
 * session cookie (a guest never sees the form or the grid flash before the sign-in gate).
 * The error boundary sits inside the shell, keyed the same way, so a new URL clears it.
 */
async function KeyedDemo({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const signedIn = Boolean(await getSessionToken());
  const state = (STATES.some((s) => s.value === sp.state) ? sp.state : '') as DemoState;
  const stepTwo = isStepTwo(state, sp.stand ?? null);
  const key = `${state}|${sp.competition ?? ''}|${sp.stand ?? ''}`;
  const fallback =
    state === 'signed-out' || !signedIn ? <GateSkeleton stepTwo={stepTwo} /> : stepTwo ? <AddCatchSkeleton /> : <LoadingFlow />;
  return (
    <DemoErrorBoundary key={key} stepTwo={stepTwo} backHref={stepTwo ? BASE : routes.competitions()}>
      <Suspense key={key} fallback={fallback}>
        <Demo sp={sp} signedIn={signedIn} />
      </Suspense>
    </DemoErrorBoundary>
  );
}

async function Demo({ sp, signedIn }: { sp: Search; signedIn: boolean }) {
  const state = (STATES.some((s) => s.value === sp.state) ? sp.state : '') as DemoState;
  const stepTwo = isStepTwo(state, sp.stand ?? null);
  // One deadline for every read of this render: a hung CMS reaches the error within 8 s in total.
  const deadline = createDeadline();

  const competitionId =
    sp.competition ?? COMPETITION[state === 'empty' || state === 'nc' || state === 'weighed' ? state : 'default'];
  /** Step 1's URL (keeps the demo state, except the step-2 ones). */
  const keep = (extra: Record<string, string>) => {
    const q = new URLSearchParams({ ...(sp.competition ? { competition: sp.competition } : {}), ...extra });
    if (state && !STEP2_STATES.includes(state) && !q.has('state')) q.set('state', state);
    return `${BASE}?${q.toString()}`;
  };
  // The failure names the step the URL opens, as its skeleton did: a stand URL stays step 2.
  const loadError = stepTwo ? (
    <ErrorFlow title="Adaugă captură" message="Nu am putut încărca standul" backHref={keep({})} backLabel="Înapoi la standuri" />
  ) : (
    <ErrorFlow backHref={routes.competition(competitionId)} backLabel="Înapoi la concurs" />
  );
  if (state === 'loading') return <LoadingFlow />;
  if (state === 'loading-add') return <AddCatchSkeleton />;
  if (state === 'error') return loadError;

  // Step 2's reads need only the ids in the URL: started now, alongside the scale, not after it —
  // with a session only. A guest gets the sign-in gate, and /weighings has no Public grant: the
  // read would only log a 403 (as /weighings-summary in loadScale). Without a session (or for a
  // free / unknown stand) loadAddCatch starts them, after the access is known.
  const stepReads = signedIn && sp.stand && state !== 'slow' ? startAddCatchReads(competitionId, sp.stand, deadline) : undefined;
  // Awaited (and handled) in loadAddCatch; this only keeps an early return from leaving it unhandled.
  stepReads?.catch(() => {});

  let scale: ScaleData | null;
  try {
    // `slow`: every request hangs, so the page's deadline is what ends the load.
    scale = await loadScale(competitionId, deadline, { hang: state === 'slow' });
  } catch (e) {
    console.error('[t6] scale load failed', e);
    return loadError;
  }
  // An unknown competition: a gate in the flow's frame, inside the shell (top bar, breadcrumb, a
  // way back), not Next's bare English 404 — thrown after streaming started, that would also be a
  // 200. TODO(route): the real /concursuri/[id]/cantar decides the 404 before streaming.
  if (!scale) return <MissingCompetition />;

  // The viewer first: signed out is the sign-in gate, whatever the demo state previews.
  const signedOut = state === 'signed-out' || scale.access === 'signed-out';
  const preview = PREVIEW_STATES.includes(state) && !signedOut;
  const access: ScaleAccess = signedOut ? 'signed-out' : preview ? 'weigh' : scale.access;
  // A preview opens the scale, so the header says what an open scale implies (LIVE), not «Viitor»;
  // the sign-in gate shows the competition's real status.
  const status = preview ? 'started' : scale.competition.status;
  const meta = <ScaleMeta scale={scale} />;
  const allStands = scale.sectors.flatMap((s) => s.stands);

  if (access === 'signed-out') {
    // After sign-in, back to the same competition and stand — never to a forced demo state.
    const next = new URLSearchParams({ competition: scale.competition.documentId, ...(sp.stand ? { stand: sp.stand } : {}) });
    return (
      <FlowLayout
        header={
          // A step-2 URL keeps step 2's frame; nothing can be added here, so the title is the
          // stand's subject, not «Adaugă captură».
          stepTwo ? (
            <FlowHeader
              id="t6-title"
              title={READ_ONLY_TITLE}
              eyebrow={scale.competition.name}
              meta={meta}
              backHref={keep({})}
              backLabel="Înapoi la standuri"
              trailing={<CompetitionStatus status={status} />}
            />
          ) : (
            <StepOneHeader scale={scale} status={status} />
          )
        }
        labelledBy="t6-title"
        variant="bare"
        narrow
      >
        <T4Gate
          icon={<ScaleIcon aria-hidden />}
          title="Intră în cont ca să folosești cântarul"
          description="Organizatorul și arbitrii concursului adaugă aici capturile de pe fiecare stand."
          actions={<ButtonLink href={`/intra?next=${encodeURIComponent(`${BASE}?${next.toString()}`)}`}>Intră în cont</ButtonLink>}
        />
      </FlowLayout>
    );
  }

  const firstOccupied = allStands.find((s) => s.occupied);
  const standId = sp.stand ?? (STEP2_STATES.includes(state) ? firstOccupied?.documentId : undefined);

  if (standId) {
    const backHref = keep({});
    const stand = allStands.find((s) => s.documentId === standId);
    const reason = blockedReason(access, scale.statuteFailed && !preview);
    const stepHeader = (title: string) => (
      <FlowHeader
        id="t6-title"
        title={title}
        eyebrow={scale.competition.name}
        meta={meta}
        backHref={backHref}
        backLabel="Înapoi la standuri"
        trailing={<CompetitionStatus status={status} />}
      />
    );
    if (!stand || !stand.occupied) {
      // The step cannot run: T4Gate, the one shape for every «can't run» (signed out, error too).
      return (
        // Titled by the subject (the stand, or that it is missing), never by the refused action.
        <FlowLayout header={stepHeader(stand ? stand.fullLabel : 'Stand negăsit')} labelledBy="t6-title" variant="bare" narrow>
          <T4Gate
            icon={<ScaleIcon aria-hidden />}
            title={stand ? 'Standul nu are pescari alocați' : 'Standul nu există'}
            description={stand ? 'Pe un stand liber nu se adaugă capturi. Alege un stand ocupat.' : 'Verifică linkul sau alege standul din listă.'}
            actions={
              <ButtonLink href={backHref} variant="secondary">
                Înapoi la standuri
              </ButtonLink>
            }
          />
        </FlowLayout>
      );
    }
    const notice = <AddNotice access={access} statuteFailed={scale.statuteFailed && !preview} />;
    // The scale is read, so access is known: header, notice and subject are real while the step's
    // own reads (species, weighings) finish, and the form skeleton shows only for a viewer who weighs.
    return (
      <Suspense
        // A new demo state or stand starts the step afresh (the form's client state too).
        key={`${standId}-${state}`}
        fallback={
          <AddCatchSkeleton
            header={stepHeader(reason ? READ_ONLY_TITLE : 'Adaugă captură')}
            notice={notice}
            subject={<StandSubject stand={stand} />}
            readOnly={Boolean(reason)}
          />
        }
      >
        <AddCatchStep
          scale={scale}
          stand={stand}
          deadline={deadline}
          reads={standId === sp.stand ? stepReads : undefined}
          backHref={backHref}
          initial={state === 'invalid' || state === 'confirmed' ? state : undefined}
          meta={meta}
          status={status}
          reason={reason}
          notice={notice}
        />
      </Suspense>
    );
  }

  const hasStands = scale.summary.standCount > 0;
  const hrefFor = Object.fromEntries(
    allStands.map((st) => [st.documentId, keep({ competition: scale.competition.documentId, stand: st.documentId })]),
  );
  return (
    <FlowLayout
      header={<StepOneHeader scale={scale} status={status} />}
      // No stands: the gate is the one message (a role notice would promise stands that do not
      // exist); a partial read failure still says so.
      notice={
        hasStands ? (
          <PickNotice scale={scale} access={access} />
        ) : scale.statuteFailed || scale.summaryFailed ? (
          <ReadFailedNotice summary={scale.summaryFailed} statute={scale.statuteFailed} />
        ) : undefined
      }
      aside={hasStands ? <ScaleSummary scale={scale} /> : undefined}
      asideMobile="hidden"
      labelledBy="t6-title"
      variant={hasStands ? 'card' : 'bare'}
      // Nothing to pick: a gate, capped and centred like every other «can't run».
      narrow={!hasStands}
    >
      {hasStands ? (
        <>
          <ScaleSummaryCompact scale={scale} />
          <StandPicker sectors={scale.sectors} hrefFor={hrefFor} readOnly={access !== 'weigh'} />
        </>
      ) : (
        <T4Gate
          icon={<ScaleIcon aria-hidden />}
          title="Niciun stand în concurs"
          description="Organizatorul nu a adăugat încă standuri pe sectoare. Cântarul apare aici după alocare."
          actions={
            <ButtonLink href={routes.competition(scale.competition.documentId)} variant="secondary">
              Înapoi la concurs
            </ButtonLink>
          }
        />
      )}
    </FlowLayout>
  );
}

/** Step 2 once its own reads land (behind the step's Suspense). */
async function AddCatchStep({
  scale,
  stand,
  deadline,
  reads,
  backHref,
  initial,
  meta,
  status,
  reason,
  notice,
}: {
  scale: ScaleData;
  stand: StandView;
  deadline: Deadline;
  reads?: ReturnType<typeof startAddCatchReads>;
  backHref: string;
  initial?: 'invalid' | 'confirmed';
  meta: ReactNode;
  status: ScaleData['competition']['status'];
  reason?: string;
  notice: ReactNode;
}) {
  let step: AddCatchData | null;
  try {
    step = await loadAddCatch(scale, stand.documentId, deadline, reads);
  } catch (e) {
    console.error('[t6] add-catch load failed', e);
    step = null;
  }
  if (!step) {
    return (
      <ErrorFlow
        title={reason ? READ_ONLY_TITLE : 'Adaugă captură'}
        message="Nu am putut încărca standul"
        eyebrow={scale.competition.name}
        meta={meta}
        trailing={<CompetitionStatus status={status} />}
        backHref={backHref}
        backLabel="Înapoi la standuri"
      />
    );
  }
  return (
    <AddCatchFlow
      data={step}
      backHref={backHref}
      initial={initial}
      eyebrow={scale.competition.name}
      meta={meta}
      trailing={<CompetitionStatus status={status} />}
      blockedReason={reason}
      notice={notice}
    />
  );
}

/** The header's meta line on both steps (lake, team / NC badges): one frame for the whole flow. */
function ScaleMeta({ scale }: { scale: ScaleData }) {
  return (
    <>
      {scale.competition.lakeName ? <span>{scale.competition.lakeName}</span> : null}
      {scale.competition.isTeam ? <Badge color="gray">Echipe</Badge> : null}
      {scale.competition.isNc ? <Badge color="gray">Campionat național</Badge> : null}
    </>
  );
}

const STATUS: Record<ScaleData['competition']['status'], { tone: StatusTone; label: string }> = {
  draft: { tone: 'neutral', label: 'Ciornă' },
  started: { tone: 'live', label: 'LIVE' },
  notStarted: { tone: 'info', label: 'Viitor' },
  completed: { tone: 'neutral', label: 'Încheiat' },
  cancelled: { tone: 'cancelled', label: 'Anulat' },
};

function CompetitionStatus({ status }: { status: ScaleData['competition']['status'] }) {
  const s = STATUS[status];
  return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
}

function StepOneHeader({ scale, status }: { scale: ScaleData; status: ScaleData['competition']['status'] }) {
  return (
    <FlowHeader
      id="t6-title"
      title="Alege standul"
      eyebrow={scale.competition.name}
      meta={<ScaleMeta scale={scale} />}
      backHref={routes.competition(scale.competition.documentId)}
      backLabel="Înapoi la concurs"
      trailing={<CompetitionStatus status={status} />}
    />
  );
}

const ROLE: Record<string, string> = { author: 'Organizator', referee: 'Arbitru', participant: 'Participant' };

/** Why step 2 is read-only, one line for the action bar; undefined when the viewer weighs. */
function blockedReason(access: ScaleAccess, statuteFailed: boolean): string | undefined {
  if (statuteFailed) return 'Nu am putut verifica rolul tău.';
  if (access === 'no-role') return 'Doar organizatorul și arbitrii pot adăuga capturi.';
  if (access === 'not-started') return 'Capturile se adaugă după startul concursului.';
  if (access === 'finished') return 'Concursul s-a încheiat; nu se mai adaugă capturi.';
  return undefined;
}

function PickNotice({ scale, access }: { scale: ScaleData; access: ScaleAccess }) {
  if (scale.statuteFailed || scale.summaryFailed) return <ReadFailedNotice summary={scale.summaryFailed} statute={scale.statuteFailed} />;
  if (access === 'no-role')
    return (
      <T4Notice role="status" title="Doar organizatorul și arbitrii cântăresc">
        Poți vedea standurile și totalurile, dar nu poți adăuga capturi.
      </T4Notice>
    );
  if (access === 'not-started')
    return (
      <T4Notice role="status" title="Cântarul se deschide la startul concursului">
        Până atunci poți verifica standurile și cine pescuiește pe fiecare.
      </T4Notice>
    );
  if (access === 'finished')
    return (
      <T4Notice role="status" title="Concursul s-a încheiat">
        Cântăririle rămân de consultat; nu se mai adaugă capturi.
      </T4Notice>
    );
  // weigh: the scale is open for this viewer — said too, so a notice is always there (the loading
  // skeleton draws one) and the role is stated where the task starts.
  return (
    <T4Notice role="status" title="Cântarul e deschis">
      {scale.role ? `Rolul tău: ${ROLE[scale.role]}. ` : ''}Alege standul și adaugă capturile.
    </T4Notice>
  );
}

/** A partial CMS failure: said plainly, with a real retry, instead of showing a fallback as fact. */
function ReadFailedNotice({ summary, statute }: { summary: boolean; statute: boolean }) {
  return (
    <T4Notice
      tone="warning"
      role="status"
      title={statute ? 'Nu am putut verifica rolul tău' : 'Totalurile nu au putut fi încărcate'}
      actions={<RetryButton />}
    >
      {statute && summary
        ? 'Nici totalurile nu s-au încărcat. Până la reîncărcare nu poți adăuga capturi.'
        : statute
          ? 'Până la reîncărcare nu poți adăuga capturi.'
          : 'Standurile sunt corecte; totalurile cântărite lipsesc.'}
    </T4Notice>
  );
}

function AddNotice({ access, statuteFailed }: { access: ScaleAccess; statuteFailed: boolean }) {
  if (statuteFailed) return <ReadFailedNotice summary={false} statute />;
  const demo = 'Demo: formularul nu trimite nimic la server.';
  if (access === 'weigh')
    return (
      <T4Notice role="status" title="Previzualizare">
        {demo}
      </T4Notice>
    );
  const title =
    access === 'no-role'
      ? 'Doar organizatorul și arbitrii cântăresc'
      : access === 'not-started'
        ? 'Cântarul se deschide la startul concursului'
        : 'Concursul s-a încheiat';
  // info, as on step 1: a timing or permission fact, not a failure (warning is ReadFailedNotice's).
  return (
    <T4Notice role="status" title={title}>
      Poți vedea standul și cântăririle lui; adăugarea e oprită.
    </T4Notice>
  );
}

function ScaleSummary({ scale }: { scale: ScaleData }) {
  const s = scale.summary;
  return (
    <FlowAsideCard title="Cântar" id="t6-summary" meta={scale.role ? `Rolul tău: ${ROLE[scale.role]}` : undefined}>
      {scale.summaryFailed ? (
        // Unknown, not zero: no total is shown rather than a false 0,000.
        <SignatureNumber value="—" size="stat" caption="Totalurile nu s-au încărcat" />
      ) : (
        <SignatureNumber
          value={formatDecimal(s.totalKg, 3, 3)}
          unit=" kg"
          size="stat"
          caption={s.regular + s.extra > 0 ? 'Total cântărit' : 'Nicio cântărire încă'}
        />
      )}
      <dl className="grid grid-cols-2 gap-3 border-t border-hairline pt-3">
        <Stat label="Standuri ocupate" value={`${s.occupied}/${s.standCount}`} />
        <Stat label="Standuri cântărite" value={scale.summaryFailed ? '—' : `${s.weighed}/${s.occupied}`} />
        <Stat label="Cântăriri" value={scale.summaryFailed ? '—' : String(s.regular)} />
        <Stat label="Cântăriri extra" value={scale.summaryFailed ? '—' : String(s.extra)} />
      </dl>
    </FlowAsideCard>
  );
}

/**
 * Below 1280 (the summary card is the aside's, hidden there): the page's signature number and one
 * caption line above the search, so phone and tablet keep the headline.
 */
function ScaleSummaryCompact({ scale }: { scale: ScaleData }) {
  const s = scale.summary;
  return (
    <div className="xl:hidden">
      {scale.summaryFailed ? (
        <SignatureNumber value="—" size="stat" caption="Totalurile nu s-au încărcat" />
      ) : (
        <SignatureNumber
          value={formatDecimal(s.totalKg, 3, 3)}
          unit=" kg"
          size="stat"
          caption={`${s.weighed}/${s.occupied} standuri cântărite · ${plural(s.regular + s.extra, 'cântărire', 'cântăriri')}`}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="t-caption text-muted">{label}</dt>
      <dd className="t-stat text-ink">{value}</dd>
    </div>
  );
}

/**
 * A load failure: T4Gate tone=danger (the one «can't run» shape), capped and centred like the
 * sign-in gate, its «Reîncearcă» at the gate's full action size. The header keeps the loading
 * skeleton's geometry: blank eyebrow and meta lines when the competition is unknown, so the
 * content does not jump when the skeleton turns into it.
 */
function ErrorFlow({
  title = 'Alege standul',
  message = 'Nu am putut încărca standurile',
  eyebrow,
  meta,
  trailing,
  backHref,
  backLabel = 'Înapoi',
}: {
  title?: string;
  message?: string;
  eyebrow?: string;
  meta?: ReactNode;
  trailing?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  const blank = <span aria-hidden>{'\u00a0'}</span>;
  return (
    <FlowLayout
      header={
        <FlowHeader
          id="t6-title"
          title={title}
          eyebrow={eyebrow ?? blank}
          meta={meta ?? blank}
          trailing={trailing}
          backHref={backHref}
          backLabel={backLabel}
        />
      }
      labelledBy="t6-title"
      variant="bare"
      narrow
    >
      {/* The alert is the message only (not the gate, whose text would include «Reîncearcă»):
          the title once more for the announcement, visually hidden, then the description. */}
      <T4Gate
        tone="danger"
        icon={<ExclamationCircleIcon aria-hidden />}
        title={message}
        description={
          <span role="alert">
            <span className="sr-only">{message}. </span>
            Verifică conexiunea și încearcă din nou.
          </span>
        }
        actions={<RetryButton size="default" variant="primary" />}
      />
    </FlowLayout>
  );
}

/** An unknown competition id: the flow's frame with a gate and the way back to the list. */
function MissingCompetition() {
  const blank = <span aria-hidden>{'\u00a0'}</span>;
  return (
    <FlowLayout
      header={
        <FlowHeader
          id="t6-title"
          title="Concurs negăsit"
          eyebrow={blank}
          meta={blank}
          backHref={routes.competitions()}
          backLabel="Înapoi la concursuri"
        />
      }
      labelledBy="t6-title"
      variant="bare"
      narrow
    >
      <T4Gate
        icon={<ScaleIcon aria-hidden />}
        title="Concursul nu există"
        description="Poate a fost șters sau linkul e greșit. Alege concursul din listă."
        actions={
          <ButtonLink href={routes.competitions()} variant="secondary">
            Înapoi la concursuri
          </ButtonLink>
        }
      />
    </FlowLayout>
  );
}
