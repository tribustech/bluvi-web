'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CloudIcon, ExclamationTriangleIcon, LockClosedIcon, PhoneIcon, TrashIcon } from '@heroicons/react/24/outline';
import { competitionQuery, userStatuteForCompetitionQuery } from '@/core/competitions';
import { lakeQuery } from '@/core/lakes';
import {
  createCompetitionDefaultValues,
  formatAutoSaveLabel,
  getDraft,
  mapCompetitionToFormData,
  mapDraftToFormData,
  type CreateCompetitionFormData,
  type EditableCompetition,
} from '@/core/organizer';
import { IconButton } from '@/components/nav/IconButton';
import {
  T4ActionBar,
  T4Frame,
  T4Gate,
  T4Header,
  T4Progress,
  T4Spinner,
  T4StepList,
  type T4Back,
} from '@/components/templates/T4';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { BLUVI_PHONE } from '@/components/organizer/CannotEditDialog';
import { Button, ButtonLink, buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { canGoBackInApp } from '@/lib/client/in-app-history';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes, type WizardStep } from '@/lib/routes';
import { logCannotEditContact, logCreateCompetitionStarted } from './analytics';
import { useWizardFrame, WizardProvider } from './context';
import {
  BlockingValidationDialog,
  DeleteDraftDialog,
  ExitDialog,
  HydrationErrorDialog,
  NameRequiredDialog,
  NoBannerDialog,
  PublishFailedDialog,
  RiskDialog,
} from './dialogs';
import { parseRichTextField, RichTextEditor, type RichTextEditorHandle } from './editor';
import { parseExplanationParam, RankingExplanationPanel } from './explanation';
import { wizardBasePath, wizardSegments, wizardSteps } from './model';
import { ProgressDialog } from './ProgressDialog';
import { WIZARD_STEP_COUNT, WIZARD_STEP_DEFS } from './stepDefs';
import { StepClasament } from './steps/clasament';
import { StepConfigurare } from './steps/configurare';
import { StepDetalii } from './steps/detalii';
import { StepLacSiSectoare } from './steps/lac-si-sectoare';
import { StepRevizuire } from './steps/revizuire';
import { reviewStepStatus } from './steps/revizuire/model';
import { StepStanduri } from './steps/standuri';
import { useWizardLeaveGuard } from './useWizardLeaveGuard';
import { WizardSkeleton } from './WizardSkeleton';
import { WizardSummary } from './WizardSummary';
import { SetBreadcrumb } from '../../_shell/SiteHeader';

/*
 * The create / edit competition wizard's frame (parity organizer.wizard c1–c26; fish
 * app/(app)/create-competition/_layout.tsx + contexts/CreateCompetitionContext.tsx) on T4:
 *  - phone: the sticky header (back · «Pasul N din 6» in the segment bar · auto-save · trash), one
 *    column of step cards, the action bar pinned to the bottom edge;
 *  - from 1280: header band, then the step list | the step | the running summary with the action
 *    bar docked under it (T4Frame), every step one click away.
 * The pages (nou/[pas], [id]/editeaza/[pas]) settle the session and the role; this component
 * hydrates (a draft, or a competition the viewer authors and that has not started), then mounts
 * WizardProvider. Steps change the URL with the History API (context.tsx), so the form, its
 * auto-save and every dialog stay mounted across steps; a reload or a shared link opens that step.
 */

type ScreenProps = {
  /** /concursuri/[id]/editeaza: the competition edited. */
  competitionId: string | null;
  /** ?ciorna= on /organizator/concursuri/nou. */
  draftId: string | null;
  /** ?inapoi=, already same-site (safeReturnPath). */
  returnTo: string | null;
  initialStep: WizardStep;
};

const EYEBROW = { new: 'Competiție nouă', draft: 'Ciornă', edit: 'Modifică competiția' } as const;

export function WizardScreen({ competitionId, draftId, returnTo, initialStep }: ScreenProps) {
  // organizer.b.wizard-analytics: once per opening (fish logs it on the layout's mount).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    logCreateCompetitionStarted({ is_editing_draft: Boolean(draftId) });
  }, [draftId]);

  if (competitionId) return <EditHydrator competitionId={competitionId} returnTo={returnTo} initialStep={initialStep} />;
  if (draftId) return <DraftHydrator draftId={draftId} returnTo={returnTo} initialStep={initialStep} />;
  return (
    <WizardProvider
      initialValues={createCompetitionDefaultValues}
      initialDraftId={null}
      competitionId={null}
      returnTo={returnTo}
      initialStep={initialStep}
    >
      <WizardFrame />
    </WizardProvider>
  );
}

/* ============================================================================================== */
/* Hydration (c25)                                                                                */
/* ============================================================================================== */

function useTransport() {
  return useMemo(() => createBrowserTransport(), []);
}

/** fish: OK on «Eroare» goes back (router.back) or home. */
function useLeaveOnError() {
  const router = useRouter();
  return useCallback(() => {
    if (canGoBackInApp()) router.back();
    else router.replace(routes.home());
  }, [router]);
}

/** The draft's lake (with its stands) is part of the hydration: the skeleton stays until it settles. */
function useHydratedLake(lakeId: string | undefined) {
  const t = useTransport();
  const q = useQuery(lakeQuery(t, lakeId ?? '', { enabled: Boolean(lakeId) }));
  return !lakeId || !q.isPending;
}

function DraftHydrator({ draftId, returnTo, initialStep }: { draftId: string; returnTo: string | null; initialStep: WizardStep }) {
  const t = useTransport();
  const leave = useLeaveOnError();
  const draft = useQuery({
    queryKey: ['organizer', 'draft', draftId],
    queryFn: () => getDraft(t, draftId),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  const lakeReady = useHydratedLake(draft.data?.lake?.documentId);
  // Mapped once the draft and its lake are in; the provider keeps its own copy from then on.
  const initial = useMemo<CreateCompetitionFormData | null>(
    () => (draft.data && lakeReady ? mapDraftToFormData(draft.data) : null),
    [draft.data, lakeReady],
  );

  if (!initial) {
    return (
      <>
        <WizardSkeleton step={initialStep} eyebrow={EYEBROW.draft} back={{ label: 'Înapoi', href: returnTo ?? routes.organizer() }} />
        <HydrationErrorDialog open={draft.isError} onOk={leave} />
      </>
    );
  }
  return (
    <WizardProvider initialValues={initial} initialDraftId={draftId} competitionId={null} returnTo={returnTo} initialStep={initialStep}>
      <WizardFrame />
    </WizardProvider>
  );
}

function EditHydrator({ competitionId, returnTo, initialStep }: { competitionId: string; returnTo: string | null; initialStep: WizardStep }) {
  const t = useTransport();
  const router = useRouter();
  const leave = useLeaveOnError();
  const session = { isAuthenticated: true };
  const competition = useQuery({ ...competitionQuery(t, competitionId, session), retry: false });
  const statute = useQuery({ ...userStatuteForCompetitionQuery(t, competitionId, session), retry: false });
  const lakeReady = useHydratedLake(competition.data?.lake?.documentId ?? undefined);
  const back: T4Back = { label: 'Înapoi la concurs', href: returnTo ?? routes.competition(competitionId) };

  // organizer.b.role-gate: the wizard edits only the author's own competition.
  const notAuthor = statute.isSuccess && statute.data?.userRole !== 'author';
  useEffect(() => {
    if (notAuthor) router.replace(routes.competition(competitionId));
  }, [competitionId, notAuthor, router]);

  const status = competition.data?.competitionStatus;
  const editable = status === 'notStarted';
  // organizer.b.cannot-edit-started: the «a început deja» notice is true only once it has started
  // (or finished). A cancelled competition has nothing to edit and nothing true to say here: back
  // to its page (rule 4). A draft is edited in the draft wizard.
  const startedOrDone = status === 'started' || status === 'completed';
  const redirect =
    statute.isSuccess && !notAuthor && status && !editable && !startedOrDone
      ? status === 'draft'
        ? routes.organizerCompetitionNew(initialStep, { ciorna: competitionId, inapoi: returnTo ?? undefined })
        : routes.competition(competitionId)
      : null;
  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);
  const ready = Boolean(competition.data) && editable && lakeReady && statute.isSuccess && !notAuthor;
  const initial = useMemo<CreateCompetitionFormData | null>(
    () => (ready && competition.data ? mapCompetitionToFormData(competition.data as unknown as EditableCompetition) : null),
    [competition.data, ready],
  );

  if (competition.data && startedOrDone && statute.isSuccess && !notAuthor) {
    return <CannotEditGate competitionId={competitionId} back={back} />;
  }
  if (!initial) {
    return (
      <>
        <WizardSkeleton step={initialStep} eyebrow={EYEBROW.edit} back={back} />
        <HydrationErrorDialog open={competition.isError || statute.isError} onOk={leave} />
      </>
    );
  }
  return (
    <WizardProvider initialValues={initial} initialDraftId={null} competitionId={competitionId} returnTo={returnTo} initialStep={initialStep}>
      <WizardFrame />
    </WizardProvider>
  );
}

/**
 * organizer.b.cannot-edit-started — fish CannotEditCompetitionSheet, the same notice as the panel's
 * CannotEditDialog (components/organizer): why, and «Apelează» (tel: Bluvi, contact_pressed «Bluvi
 * cannot edit contact»); «Înapoi la concurs» is the page's way out (the sheet's backdrop on fish).
 */
function CannotEditGate({ competitionId, back }: { competitionId: string; back: T4Back }) {
  return (
    <T4Frame pageState label="Modifică competiția" header={<T4Header title="Modifică competiția" back={back} />}>
      <T4Gate
        role="alert"
        icon={<LockClosedIcon />}
        title="Nu poți modifica competiția"
        description="Competiția a început deja. Pentru modificări, contactează echipa Bluvi."
        actions={
          <>
            <a
              href={`tel:${BLUVI_PHONE}`}
              onClick={logCannotEditContact}
              className={buttonClass({ variant: 'primary' })}
              data-testid="cannot-edit-call"
            >
              <PhoneIcon aria-hidden className="size-5" />
              Apelează
            </a>
            <ButtonLink href={routes.competition(competitionId)} variant="secondary">
              Înapoi la concurs
            </ButtonLink>
          </>
        }
      />
    </T4Frame>
  );
}

/* ============================================================================================== */
/* The frame                                                                                      */
/* ============================================================================================== */

type SaveState = Parameters<typeof formatAutoSaveLabel>[0];

/**
 * c2 — the auto-save state: spinner «Se salvează...», cloud «Salvat la HH:mm», amber «Nu s-a putut
 * salva automat»; nothing while idle. ONE live region, always mounted where it is shown (the header
 * below 1280, the sticky rail from 1280), so every change is announced once.
 */
function AutoSaveStatus({ state, separator }: { state: SaveState; separator: boolean }) {
  const label = formatAutoSaveLabel(state);
  const icon = !label ? null : label.icon === 'saving' ? (
    <T4Spinner className="size-4" />
  ) : label.icon === 'saved' ? (
    <CloudIcon aria-hidden className="size-4 shrink-0" />
  ) : (
    <ExclamationTriangleIcon aria-hidden className="size-4 shrink-0" />
  );
  return (
    <span
      role="status"
      data-testid="wizard-autosave"
      data-state={label?.icon ?? 'idle'}
      className={cn('flex min-w-0 items-center gap-1', label?.icon === 'error' ? 'text-status-warning-fg' : 'text-muted')}
    >
      {label ? (
        <>
          {separator ? (
            <span aria-hidden className="mr-0.5 shrink-0 text-muted">
              ·
            </span>
          ) : null}
          {icon}
          <span className="truncate">{label.text}</span>
        </>
      ) : null}
    </span>
  );
}

/**
 * c1 — «Pasul N din 6», then (below 1280) the auto-save state after a «·». The counter stays on a
 * phone too (fish shows it under the title at every size), so the line is never an empty band.
 * From 1280 the header band scrolls away (T4Frame), so the save state lives in the sticky rail.
 */
function WizardStatusLine({ step, state, showSave }: { step: number; state: SaveState; showSave: boolean }) {
  return (
    <>
      <span className="shrink-0" data-testid="wizard-step-counter">
        Pasul {step} din {WIZARD_STEP_COUNT}
      </span>
      {showSave ? <AutoSaveStatus state={state} separator /> : null}
    </>
  );
}

/**
 * The rail's save note (≥1280), true to the state: editing a published competition saves only on
 * demand; an unnamed new competition is not saved yet; offline pauses auto-save; else the live
 * status (and the promise only while nothing has been tried yet).
 */
function RailSaveNote({ mode, nameValid, online, state }: { mode: string; nameValid: boolean; online: boolean; state: SaveState }) {
  if (mode === 'edit') return <p className="t-caption text-muted">Modificările se aplică abia când le salvezi.</p>;
  const caption = !nameValid
    ? 'Adaugă un nume ca să salvăm ciorna.'
    : !online
      ? 'Ești offline: salvarea automată e în pauză.'
      : state.status === 'idle'
        ? 'Ciorna se salvează automat cât timp ești online.'
        : state.status === 'error'
          ? 'Încercăm din nou la următoarea modificare.'
          : null;
  return (
    <div className="t-caption flex flex-col gap-1">
      <AutoSaveStatus state={state} separator={false} />
      {caption ? <p className="text-muted">{caption}</p> : null}
    </div>
  );
}

function WizardFrame() {
  const w = useWizardFrame();
  const { internals: x } = w;
  const def = WIZARD_STEP_DEFS[w.stepIndex];
  const isLast = w.stepIndex === WIZARD_STEP_COUNT - 1;
  const [exitOpen, setExitOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const heldLeave = useRef<(() => void) | null>(null);
  const basePath = wizardBasePath(w.competitionId ?? null);
  // The save state shows once: in the header below 1280, in the sticky rail from 1280 (c2).
  const desktop = useBreakpoint() === 'desktop';

  const editorField = w.step === 'detalii' && w.query.get('editor') ? parseRichTextField(w.query.get('editor')) : null;
  // The open rich text editor's unapplied text counts as unsaved (organizer.rich-text-editor).
  const [editorDirty, setEditorDirty] = useState(false);
  const editorHandle = useRef<RichTextEditorHandle>(null);

  // The leave guard: a dirty form is never dropped silently (c4, web: links, Back, closing the tab).
  const guardActive = (w.dirty || (editorField != null && editorDirty)) && !w.busy && !x.leaving;
  useWizardLeaveGuard({
    active: guardActive,
    basePath,
    onHold: leave => {
      heldLeave.current = leave;
      setExitOpen(true);
    },
  });

  // c4 — back: the previous step; on step 1 leave (asking first when the form is dirty).
  const onBack = () => {
    if (w.busy) return;
    if (w.stepIndex > 0) {
      w.goBack();
      return;
    }
    if (w.dirty) {
      heldLeave.current = null;
      setExitOpen(true);
    } else {
      x.exit();
    }
  };

  const closeExit = () => {
    heldLeave.current = null;
    setExitOpen(false);
  };
  const saveFromExit = () => {
    heldLeave.current = null;
    setExitOpen(false);
    editorHandle.current?.apply();
    void w.saveAndExit();
  };
  const discardFromExit = () => {
    const held = heldLeave.current;
    heldLeave.current = null;
    setExitOpen(false);
    if (held) held();
    else x.exit();
  };

  const fillName = () => {
    x.dismissNameRequired();
    if (w.step !== 'detalii') w.goTo('detalii');
    requestAnimationFrame(() => document.getElementById(w.fieldIds.name)?.focus());
  };

  const explanation = w.step === 'clasament' ? parseExplanationParam(w.query.get('explicatie')) : null;

  // On the review step the rail says what the review cards say (the same error codes).
  const steps = wizardSteps(w.step, x.completedSteps, w.step === 'revizuire' ? reviewStepStatus(w.values) : undefined);
  const name = w.values.name?.trim();
  const eyebrow = `${EYEBROW[w.mode]}${name ? ` · ${name}` : ''}`;

  const header = (
    <T4Header
      title={def.title}
      eyebrow={eyebrow}
      status={<WizardStatusLine step={w.stepIndex + 1} state={w.autoSave} showSave={!desktop} />}
      // While the editor is open its own back and «Gata» are the only ways out of it (fish's
      // full-screen route): no header back, no step jumps that would drop its text.
      back={editorField ? undefined : { label: w.stepIndex > 0 ? 'Pasul anterior' : 'Ieși din asistent', onClick: onBack }}
      busy={w.busy}
      focusKey={w.step}
      trailing={
        w.mode === 'draft' ? (
          <IconButton
            aria-label="Șterge ciorna"
            title="Șterge ciorna"
            disabled={w.busy}
            onClick={() => setDeleteOpen(true)}
            className="bg-soft-fill text-status-danger-fg hover:text-status-danger-fg disabled:cursor-not-allowed disabled:opacity-50"
          >
            <TrashIcon aria-hidden />
          </IconButton>
        ) : null
      }
      progress={
        <T4Progress steps={wizardSegments(w.step)} onSelect={editorField ? undefined : id => w.goTo(id as WizardStep)} label="Pașii competiției" />
      }
    />
  );

  const primary: ReactNode = !isLast ? (
    <Button onClick={w.goNext} disabled={w.busy} data-testid="wizard-next">
      Următorul pas
    </Button>
  ) : w.mode === 'edit' ? (
    <Button
      onClick={() => void w.saveAndExit()}
      disabled={x.publishBlocked || w.busy}
      icon={x.operation.mode === 'save' ? <T4Spinner /> : undefined}
      data-testid="wizard-save-edit"
    >
      {w.saveLabel}
    </Button>
  ) : (
    <Button
      onClick={() => void w.publish()}
      disabled={x.publishBlocked || w.busy}
      icon={x.operation.mode === 'publish' ? <T4Spinner /> : undefined}
      data-testid="wizard-publish"
    >
      Publică competiția
    </Button>
  );

  const actions = editorField ? undefined : (
    <T4ActionBar
      primary={primary}
      secondary={
        isLast || (def.saveOnlyInEdit && w.mode !== 'edit') ? undefined : (
          <Button variant="secondary" onClick={() => void w.saveAndExit()} disabled={w.busy} data-testid="wizard-save">
            {w.saveLabel}
          </Button>
        )
      }
      back={
        w.stepIndex > 0 ? (
          <Button variant="ghost" onClick={w.goBack} disabled={w.busy}>
            Înapoi
          </Button>
        ) : undefined
      }
    />
  );

  const crumbs =
    w.mode === 'edit' && w.competitionId
      ? [
          { label: 'Competiții', href: routes.competitions() },
          ...(name ? [{ label: name, href: routes.competition(w.competitionId) }] : []),
          { label: 'Modifică' },
        ]
      : [{ label: 'Concursurile mele', href: routes.organizer() }, { label: name || EYEBROW[w.mode] }];

  return (
    <>
      <SetBreadcrumb trail={crumbs} />
      <T4Frame
        label={`Pasul ${w.stepIndex + 1}: ${def.title}`}
        busy={w.busy}
        header={header}
        rail={
          <div className="flex flex-col gap-6">
            <T4StepList steps={steps} onSelect={editorField ? undefined : id => w.goTo(id as WizardStep)} label="Pașii competiției" />
            {desktop ? (
              <RailSaveNote mode={w.mode} nameValid={(name ?? '').length >= 3} online={w.online} state={w.autoSave} />
            ) : null}
          </div>
        }
        aside={<WizardSummary />}
        actions={actions}
      >
        <div data-testid="wizard-step" data-step={w.step} className="contents">
          {editorField ? (
            <RichTextEditor key={editorField} field={editorField} onDirtyChange={setEditorDirty} handle={editorHandle} />
          ) : (
            <StepBody step={w.step} />
          )}
        </div>
      </T4Frame>

      {explanation ? <RankingExplanationPanel target={explanation} onClose={() => w.setQuery({ explicatie: null }, { replace: true })} /> : null}

      <ExitDialog
        open={exitOpen}
        saveLabel={w.saveLabel}
        saving={x.isSaving}
        onSave={saveFromExit}
        onDiscard={discardFromExit}
        onClose={closeExit}
      />
      <DeleteDraftDialog
        open={deleteOpen}
        busy={x.operation.mode === 'delete'}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          setDeleteOpen(false);
          void x.deleteDraft();
        }}
      />
      <NameRequiredDialog open={x.nameRequired} onFill={fillName} onClose={x.dismissNameRequired} />
      <RiskDialog warning={x.riskWarning} saving={x.isSaving} onConfirm={() => void x.confirmRiskAndSave()} onClose={x.dismissRiskWarning} />
      <BlockingValidationDialog error={x.blockingError} onClose={x.dismissBlockingError} />
      <PublishFailedDialog message={x.publishError} onRetry={() => void x.retryPublish()} onClose={x.dismissPublishError} />
      <NoBannerDialog open={x.noBannerOpen} onAnswer={x.answerNoBanner} />
      <ProgressDialog operation={x.operation} onStay={x.stayAfterTimeout} onCheck={x.leaveAfterTimeout} />
    </>
  );
}

function StepBody({ step }: { step: WizardStep }) {
  switch (step) {
    case 'detalii':
      return <StepDetalii />;
    case 'configurare':
      return <StepConfigurare />;
    case 'clasament':
      return <StepClasament />;
    case 'lac-si-sectoare':
      return <StepLacSiSectoare />;
    case 'standuri':
      return <StepStanduri />;
    case 'revizuire':
      return <StepRevizuire />;
  }
}
