'use client';

/*
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  The create / edit competition wizard — shared contract for the step agents (M6-B2…B4)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * fish: app/(app)/create-competition/_layout.tsx + contexts/CreateCompetitionContext.tsx (parity
 * organizer.wizard). Routes: /organizator/concursuri/nou/[pas] (new; `?ciorna=` a saved draft) and
 * /concursuri/[id]/editeaza/[pas] (a published, not-started competition, author only); `?inapoi=` is
 * fish's returnTo. The frame (header, step bar, action bar, every dialog, auto-save) is
 * _wizard/WizardScreen.tsx; a step only renders its fields.
 *
 *  Step bodies — one file per step, final names (the stubs say «În lucru» until replaced):
 *    _wizard/steps/detalii/index.tsx          export function StepDetalii()
 *    _wizard/steps/configurare/index.tsx      export function StepConfigurare()
 *    _wizard/steps/clasament/index.tsx        export function StepClasament()
 *    _wizard/steps/lac-si-sectoare/index.tsx  export function StepLacSiSectoare()
 *    _wizard/steps/standuri/index.tsx         export function StepStanduri()
 *    _wizard/steps/revizuire/index.tsx        export function StepRevizuire()
 *  Render T4Section cards (components/templates/T4); no header, no action bar, no page frame.
 *
 *  Rich text editor — _wizard/editor/index.tsx `export function RichTextEditor({ field })`,
 *  field: 'descriere' | 'premii' | 'regulament'. The frame renders it INSTEAD of StepDetalii when the
 *  URL has ?editor=<field> on «detalii» (open: `setQuery({ editor: 'premii' })`; close:
 *  `setQuery({ editor: null })`). It owns its «Gata» / back; the frame hides its action bar meanwhile.
 *
 *  Ranking explanation — _wizard/explanation/index.tsx `export function RankingExplanationPanel({
 *  target, onClose })` + `explanationParam(target)` / `parseExplanationParam(value)`. The frame
 *  renders the panel over «clasament» while ?explicatie=<explanationParam(target)> is in the URL
 *  (open: `setQuery({ explicatie: explanationParam(target) })`; onClose clears it).
 *
 *  useWizard() — everything a step needs:
 *    mode              'new' (nothing saved yet) | 'draft' (a saved draft) | 'edit' (published competition)
 *    values            CreateCompetitionFormData (core/organizer), the form's current values
 *    errors            createCompetitionSchema issues, first message per field (show once `touched`)
 *    touched           fields the user has left (touch) — when to show a field's error
 *    setValue(f, v, { autoSave, normalize })  'now' = save at once, 'debounced' = 500 ms, false (default) = none;
 *                      normalize: a self-correction that does not make the form dirty (fish, no shouldDirty)
 *    touch(f)          the field lost focus: marks it touched and auto-saves now (fish onBlur)
 *    flushAutoSave()   run a pending auto-save now; resolves when it settled (never rejects)
 *    goTo(pas) / goNext() / goBack()   step navigation (each flushes the auto-save first)
 *    step, stepIndex   the current step slug, 0-based index
 *    saveLabel         «Salvează modificările» (draft / edit) | «Salvează și ieși» (new)
 *    canSave           online, nothing running and a name of ≥ 3 characters
 *    saveAndExit(), publish()   the frame's buttons (exposed for the review step's own use)
 *    lake              { data: LakeDetail | null (with stands), loading, error } for values.lake
 *    busy              a save / publish / delete is running: disable inputs
 *    online            the browser's online flag (auto-save pauses offline)
 *    dirty             values differ from the last loaded / saved ones
 *    competitionId?, draftId?
 *    pickBanner(blob, filename?) / clearBanner()   a picked (cropped, compressed) banner → an object
 *                      URL in values.banner, uploaded on the next save; a saved one is the CMS URL
 *    query, setQuery(patch, { replace? })   the page's search params (`null` removes a key)
 *    reviewErrors      fish step-review's per-card error codes { basics, config, ranking, lakeSectors }
 *    setPublishBlocked(b)   an EXTRA condition for the review step's primary: the frame already keeps
 *                      «Publică competiția» / «Salvează modificările» disabled on any schema or review
 *                      error (fish hasAnyError); a step only adds its own
 *    fieldIds          DOM ids the frame focuses (fieldIds.name: the name input of step 1)
 *  Dev-only test seam: window.__bluviWizard { setValue, touch, pickBanner, values() } (not in a
 *  production build) — the frame's e2e drives values through it while the steps are stubs.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { competitionsKeys, rankingsKeys } from '@/core/competitions';
import { lakeQuery, type LakeDetail } from '@/core/lakes';
import {
  buildCompetitionPayload,
  buildTimeoutRecovery,
  competitionManagementKeys,
  createDraftMutation,
  deleteDraftMutation,
  DELETE_FAILED_FALLBACK_MESSAGE,
  getCompletedSteps,
  getCreateCompetitionPublishJoke,
  getCreateCompetitionPublishStatus,
  getEditSavedMessage,
  getOperationStatusText,
  getSaveActionLabel,
  OFFLINE_ACTION_MESSAGE,
  OPERATION_COMPLETION_DELAY_MS,
  OPERATION_TIMEOUT_MS,
  organizerKeys,
  PUBLISH_FAILED_FALLBACK_MESSAGE,
  PUBLISH_JOKE_INTERVAL_MS,
  publishDraftMutation,
  SAVE_FAILED_FALLBACK_MESSAGE,
  shouldAttemptAutoSave,
  updateDraftMutation,
  updateOrganizerCompetitionMutation,
  type AutoSaveState,
  type CreateCompetitionFormData,
  type OperationMode,
  type OrganizerEditRiskDetails,
  type TimeoutRecovery,
} from '@/core/organizer';
import { uploadMedia, uploadMediaAndAttachToEntity } from '@/core/social';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes, type WizardStep } from '@/lib/routes';
import { useSiteToast } from '../../_shell/Toast';
import {
  captureCreateCompetitionError,
  captureOperationTimeout,
  logCreateCompetitionDraftSaved,
  logCreateCompetitionPublishAttempted,
  logCreateCompetitionPublishFailed,
  logCreateCompetitionPublishSucceeded,
} from './analytics';
import { AUTO_SAVE_DEBOUNCE_MS, AUTO_SAVE_RETRY_MS, createAutoSaveScheduler } from './autosave';
import {
  exitTarget,
  fieldErrors,
  isLocalBanner,
  isPublishBlocked,
  reviewErrors as getReviewErrors,
  triageEditError,
  valuesEqual,
  wizardStepPath,
  type WizardField,
  type WizardFieldErrors,
  type WizardReviewErrors,
} from './model';
import { stepFromPath, stepIndex as indexOf, WIZARD_STEP_DEFS } from './stepDefs';

export type WizardMode = 'new' | 'draft' | 'edit';
export type AutoSaveOption = 'now' | 'debounced' | false;
/**
 * autoSave: see the contract. normalize: a correction the step applies by itself (fish setValue
 * without shouldDirty) — when the field still held its loaded / saved value, the baseline moves
 * with it, so `dirty` stays false.
 */
export type SetValueOptions = { autoSave?: AutoSaveOption; normalize?: boolean };
export type WizardLake = { data: LakeDetail | null; loading: boolean; error: boolean };

/** DOM ids the frame moves focus to (the step that renders the control uses the same id). */
export const WIZARD_FIELD_IDS = { name: 'concurs-nume' } as const;

/** The page-level operation in progress (fish OperationFeedback). */
export type WizardOperation = {
  mode: OperationMode | null;
  statusText: string;
  jokeText: string;
  timedOut: boolean;
  recovery: TimeoutRecovery | null;
  progress: number;
};

const NO_OPERATION: WizardOperation = { mode: null, statusText: '', jokeText: '', timedOut: false, recovery: null, progress: 0 };

export type WizardContextValue = {
  mode: WizardMode;
  values: CreateCompetitionFormData;
  errors: WizardFieldErrors;
  touched: ReadonlySet<WizardField>;
  setValue: <K extends WizardField>(field: K, value: CreateCompetitionFormData[K], opts?: SetValueOptions) => void;
  touch: (field: WizardField) => void;
  flushAutoSave: () => Promise<void>;
  goTo: (pas: WizardStep) => void;
  goNext: () => void;
  goBack: () => void;
  step: WizardStep;
  stepIndex: number;
  saveLabel: string;
  canSave: boolean;
  saveAndExit: () => Promise<void>;
  publish: () => Promise<void>;
  lake: WizardLake;
  busy: boolean;
  online: boolean;
  dirty: boolean;
  competitionId?: string;
  draftId?: string;
  autoSave: AutoSaveState;
  pickBanner: (file: Blob, filename?: string) => void;
  clearBanner: () => void;
  query: URLSearchParams;
  setQuery: (patch: Record<string, string | null>, opts?: { replace?: boolean }) => void;
  setPublishBlocked: (blocked: boolean) => void;
  /** fish step-review's per-card errors (model.reviewErrors); the frame gates publish on them. */
  reviewErrors: WizardReviewErrors;
  fieldIds: typeof WIZARD_FIELD_IDS;
};

/** What only the frame reads (dialogs, the operation, exits). */
export type WizardInternals = {
  operation: WizardOperation;
  /** The review step's primary is disabled: a schema / review error (frame-owned) or the step's own setPublishBlocked. */
  publishBlocked: boolean;
  completedSteps: number[];
  returnTo: string | null;
  isSaving: boolean;
  nameRequired: boolean;
  dismissNameRequired: () => void;
  riskWarning: OrganizerEditRiskDetails | null;
  dismissRiskWarning: () => void;
  confirmRiskAndSave: () => Promise<void>;
  blockingError: { bluCode: string; message: string } | null;
  dismissBlockingError: () => void;
  publishError: string | null;
  dismissPublishError: () => void;
  retryPublish: () => Promise<void>;
  noBannerOpen: boolean;
  answerNoBanner: (proceed: boolean) => void;
  deleteDraft: () => Promise<void>;
  exit: (target?: string) => void;
  stayAfterTimeout: () => void;
  leaveAfterTimeout: () => void;
  /** The wizard is navigating away on purpose: the leave guard stands down. */
  leaving: boolean;
};

const WizardContext = createContext<(WizardContextValue & { internals: WizardInternals }) | null>(null);

/** The step agents' hook (contract above). */
export function useWizard(): WizardContextValue {
  const ctx = use(WizardContext);
  if (!ctx) throw new Error('useWizard must be used inside <WizardProvider>');
  return ctx;
}

/** The frame's hook: the public contract plus the dialogs' state. */
export function useWizardFrame(): WizardContextValue & { internals: WizardInternals } {
  const ctx = use(WizardContext);
  if (!ctx) throw new Error('useWizardFrame must be used inside <WizardProvider>');
  return ctx;
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** The browser's online flag (fish useNetInfoContext().isOnline); online on the server. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

/** history.state key: how many step entries this wizard pushed on top of its first one. */
const DEPTH_KEY = 'bluviWizardDepth';
const wizardDepth = (): number => {
  const d = (window.history.state as Record<string, unknown> | null)?.[DEPTH_KEY];
  return typeof d === 'number' && Number.isInteger(d) && d > 0 ? d : 0;
};

/** Read at the moment of the action (fish reads isOnline from its NetInfo context). */
const isOnlineNow = () => typeof navigator === 'undefined' || navigator.onLine;

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

type Props = {
  /** The hydrated values (defaults for a new competition). */
  initialValues: CreateCompetitionFormData;
  /** A saved draft (?ciorna=). */
  initialDraftId: string | null;
  /** A published competition being edited (/concursuri/[id]/editeaza). */
  competitionId: string | null;
  /** fish returnTo (?inapoi=, already checked same-site). */
  returnTo: string | null;
  /** The step the page was loaded on. */
  initialStep: WizardStep;
  children: ReactNode;
};

export function WizardProvider({ initialValues, initialDraftId, competitionId, returnTo, initialStep, children }: Props) {
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useSiteToast();
  const online = useOnline();

  const isEditCompetition = Boolean(competitionId);
  const step = stepFromPath(pathname) ?? initialStep;
  const stepIdx = indexOf(step);

  /* ── form state ────────────────────────────────────────────────────────────────────────────── */
  const [values, setValues] = useState<CreateCompetitionFormData>(initialValues);
  const valuesRef = useRef(values);
  const [baseline, setBaseline] = useState<CreateCompetitionFormData>(initialValues);
  const baselineRef = useRef(baseline);
  const [touched, setTouched] = useState<ReadonlySet<WizardField>>(() => new Set());
  const dirty = !valuesEqual(values, baseline);
  const errors = useMemo(() => fieldErrors(values), [values]);

  const [draftId, setDraftId] = useState<string | null>(initialDraftId);
  const draftIdRef = useRef<string | null>(initialDraftId);
  const [autoSave, setAutoSave] = useState<AutoSaveState>({ status: 'idle' });
  const autoSaveInFlightRef = useRef<Promise<void> | null>(null);
  /**
   * A save-and-exit / publish / delete is running (set BEFORE it awaits the in-flight auto-save):
   * auto-save stands down, so it never writes beside the operation (a second POST create while
   * the operation's own has not set the draft id yet, a PUT racing a DELETE). A counter because
   * publish in edit mode runs saveAndExit inside itself.
   */
  const operationRunningRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** Banners picked on this device, by object URL (fish keeps the device file URI). */
  const bannerBlobs = useRef(new Map<string, { blob: Blob; filename?: string }>());
  const lastUploadedBannerRef = useRef<{ url: string; id: number; documentId?: string } | null>(null);
  useEffect(() => {
    const blobs = bannerBlobs.current;
    return () => {
      for (const url of blobs.keys()) URL.revokeObjectURL(url);
      blobs.clear();
    };
  }, []);

  const createDraft = useMutation(createDraftMutation(t, qc));
  const updateDraft = useMutation(updateDraftMutation(t));
  const publishMutation = useMutation(publishDraftMutation(t, qc));
  const deleteMutation = useMutation(deleteDraftMutation(t, qc));
  const updateCompetition = useMutation(updateOrganizerCompetitionMutation(t, qc));

  /* ── operation (save / publish / delete) feedback ──────────────────────────────────────────── */
  const [operation, setOperation] = useState<WizardOperation>(NO_OPERATION);
  const timedOutRef = useRef(false);
  const timeoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jokeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jokeIndex = useRef(0);
  const [nameRequired, setNameRequired] = useState(false);
  const [riskWarning, setRiskWarning] = useState<OrganizerEditRiskDetails | null>(null);
  const [blockingError, setBlockingError] = useState<{ bluCode: string; message: string } | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [noBannerOpen, setNoBannerOpen] = useState(false);
  const noBannerResolver = useRef<((proceed: boolean) => void) | null>(null);
  const [publishBlocked, setPublishBlocked] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const clearTimers = useCallback(() => {
    if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
    if (jokeTimer.current) clearTimeout(jokeTimer.current);
    timeoutTimer.current = null;
    jokeTimer.current = null;
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const resetOperation = useCallback(() => {
    clearTimers();
    timedOutRef.current = false;
    jokeIndex.current = 0;
    if (mountedRef.current) setOperation(NO_OPERATION);
  }, [clearTimers]);

  const setProgress = useCallback((progress: number) => setOperation(op => ({ ...op, progress })), []);

  const startOperation = useCallback(
    (mode: OperationMode, progress: number) => {
      clearTimers();
      timedOutRef.current = false;
      setOperation({
        mode,
        statusText: getOperationStatusText(mode),
        jokeText: mode === 'publish' ? getCreateCompetitionPublishJoke(0) : '',
        timedOut: false,
        recovery: null,
        progress,
      });
      if (mode === 'publish') {
        jokeIndex.current = 0;
        const next = () => {
          jokeTimer.current = setTimeout(() => {
            jokeIndex.current += 1;
            setOperation(op => (op.mode ? { ...op, jokeText: getCreateCompetitionPublishJoke(jokeIndex.current) } : op));
            next();
          }, PUBLISH_JOKE_INTERVAL_MS);
        };
        next();
      }
      timeoutTimer.current = setTimeout(() => {
        timedOutRef.current = true;
        if (jokeTimer.current) clearTimeout(jokeTimer.current);
        jokeTimer.current = null;
        const recovery = buildTimeoutRecovery({ mode, draftId: draftIdRef.current, competitionId });
        setOperation(op => ({ ...op, timedOut: true, recovery }));
        const analyticsStep = WIZARD_STEP_DEFS[indexOf(stepFromPath(window.location.pathname) ?? initialStep)].analytics;
        if (mode === 'publish') logCreateCompetitionPublishFailed({ reason: 'timeout', draft_id: draftIdRef.current });
        captureOperationTimeout(mode, {
          step: analyticsStep,
          draft_id: draftIdRef.current,
          ranking_type: valuesRef.current.rankingType || undefined,
        });
      }, OPERATION_TIMEOUT_MS);
    },
    [clearTimers, competitionId, initialStep],
  );

  /** fish OPERATION_COMPLETION_DELAY_MS: the bar rests at 100 % before the flow leaves. */
  const completeOperation = useCallback(async () => {
    setProgress(100);
    await wait(OPERATION_COMPLETION_DELAY_MS);
  }, [setProgress]);

  /* ── navigation ────────────────────────────────────────────────────────────────────────────── */
  const query = useMemo(() => new URLSearchParams(searchParams?.toString() ?? ''), [searchParams]);

  /**
   * Steps and overlays change the URL with the History API: the page (and this state) stays
   * mounted. Every entry the wizard pushes carries its depth, so leaving can first rewind to the
   * wizard's first entry and replace it (exit below): the wizard leaves no step behind in history.
   */
  const writeUrl = useCallback((url: string, replace: boolean) => {
    const depth = wizardDepth();
    if (replace) window.history.replaceState({ [DEPTH_KEY]: depth }, '', url);
    else window.history.pushState({ [DEPTH_KEY]: depth + 1 }, '', url);
  }, []);

  const stepUrl = useCallback(
    (pas: WizardStep) => {
      const q = new URLSearchParams(window.location.search);
      q.delete('editor');
      q.delete('explicatie');
      const s = q.toString();
      return `${wizardStepPath(pas, competitionId)}${s ? `?${s}` : ''}`;
    },
    [competitionId],
  );

  const setQuery = useCallback(
    (patch: Record<string, string | null>, opts?: { replace?: boolean }) => {
      const q = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === '') q.delete(k);
        else q.set(k, v);
      }
      const s = q.toString();
      writeUrl(`${window.location.pathname}${s ? `?${s}` : ''}`, Boolean(opts?.replace));
    },
    [writeUrl],
  );

  /* ── auto-save (c21) ───────────────────────────────────────────────────────────────────────── */
  const attachBannerIfNeeded = useCallback(
    async (entityId: number | undefined) => {
      const banner = valuesRef.current.banner;
      if (!entityId || !isLocalBanner(banner) || lastUploadedBannerRef.current?.url === banner) return;
      const file = bannerBlobs.current.get(banner);
      if (!file) return;
      const uploaded = await uploadMediaAndAttachToEntity(t, {
        files: [{ blob: file.blob, filename: file.filename ?? `competition_banner_${Date.now()}.jpg` }],
        id: entityId,
        ref: 'api::competition.competition',
        field: 'banner',
      });
      const first = uploaded[0];
      lastUploadedBannerRef.current = { url: banner, id: first?.id ?? 0 };
    },
    [t],
  );

  const hasBannerToUpload = () => {
    const banner = valuesRef.current.banner;
    return isLocalBanner(banner) && lastUploadedBannerRef.current?.url !== banner;
  };

  /** A new draft got its documentId: keep it in the URL so a reload reopens it (web addition). */
  const rememberDraft = useCallback(
    (id: string) => {
      draftIdRef.current = id;
      setDraftId(id);
      const q = new URLSearchParams(window.location.search);
      q.set('ciorna', id);
      writeUrl(`${window.location.pathname}?${q.toString()}`, true);
    },
    [writeUrl],
  );

  /** Create or update the draft with `payload`; the entity's numeric id (for the banner). */
  const writeDraft = useCallback(
    async (payload: Record<string, unknown>): Promise<{ id: number; documentId: string }> => {
      const current = draftIdRef.current;
      if (current) {
        const updated = await updateDraft.mutateAsync({ id: current, data: payload });
        return { id: updated.id, documentId: updated.documentId || current };
      }
      const created = await createDraft.mutateAsync(payload);
      rememberDraft(created.documentId);
      return { id: created.id, documentId: created.documentId };
    },
    [createDraft, rememberDraft, updateDraft],
  );

  const markSaved = useCallback((snapshot: CreateCompetitionFormData) => {
    baselineRef.current = snapshot;
    setBaseline(snapshot);
  }, []);

  const autoSaveDraft = useCallback(async (): Promise<void> => {
    if (operationRunningRef.current > 0) return;
    const snapshot = valuesRef.current;
    const gateOk = shouldAttemptAutoSave({
      isOnline: isOnlineNow(),
      isEditCompetitionMode: isEditCompetition,
      name: snapshot.name,
      isDirty: !valuesEqual(snapshot, baselineRef.current),
      isInFlight: autoSaveInFlightRef.current !== null,
    });
    if (!gateOk) return;
    const payload = buildCompetitionPayload(snapshot);
    setAutoSave({ status: 'saving' });
    const withBanner = hasBannerToUpload();
    const runSave = async () => {
      const entity = await writeDraft(payload);
      if (withBanner) await attachBannerIfNeeded(entity.id);
    };
    let saved = false;
    const promise = (async () => {
      try {
        try {
          await runSave();
        } catch (first) {
          if (!isOnlineNow() || operationRunningRef.current > 0) throw first;
          await wait(AUTO_SAVE_RETRY_MS);
          // An operation started during the wait writes the form itself: no retry beside it.
          if (operationRunningRef.current > 0) throw first;
          await runSave();
        }
        if (!mountedRef.current) return;
        markSaved(snapshot);
        setAutoSave({ status: 'saved', at: new Date() });
        saved = true;
      } catch {
        if (mountedRef.current) setAutoSave({ status: 'error', at: new Date() });
      } finally {
        autoSaveInFlightRef.current = null;
      }
    })();
    autoSaveInFlightRef.current = promise;
    await promise;
    // Edits typed while a SUCCESSFUL save was in flight get their own save. After a failure (one
    // retry already spent, fish autoSaveDraft) nothing is rescheduled: the next edit or blur
    // (setValue / touch) tries again — never a loop of writes against a CMS that keeps refusing.
    if (
      saved &&
      mountedRef.current &&
      operationRunningRef.current === 0 &&
      !valuesEqual(valuesRef.current, baselineRef.current)
    ) {
      schedulerRef.current.schedule();
    }
  }, [attachBannerIfNeeded, isEditCompetition, markSaved, writeDraft]);

  const schedulerRef = useRef(createAutoSaveScheduler({ save: () => Promise.resolve(), delayMs: AUTO_SAVE_DEBOUNCE_MS }));
  useEffect(() => {
    schedulerRef.current.setSave(autoSaveDraft);
  }, [autoSaveDraft]);
  useEffect(() => {
    const scheduler = schedulerRef.current;
    return () => scheduler.cancel();
  }, []);

  const flushAutoSave = useCallback(async () => {
    if (autoSaveInFlightRef.current) await autoSaveInFlightRef.current.catch(() => {});
    await schedulerRef.current.flush();
  }, []);

  const awaitInFlight = useCallback(async () => {
    if (autoSaveInFlightRef.current) await autoSaveInFlightRef.current.catch(() => {});
  }, []);

  /**
   * Run a page-level operation (save and exit, publish, delete) with auto-save stood down: the flag
   * is up before the in-flight auto-save is awaited, the timer is dropped before and after, so no
   * auto-save write starts while the operation runs.
   */
  const withOperation = useCallback(
    async (run: () => Promise<void>) => {
      operationRunningRef.current += 1;
      schedulerRef.current.cancel();
      try {
        await awaitInFlight();
        schedulerRef.current.cancel();
        await run();
      } finally {
        operationRunningRef.current -= 1;
      }
    },
    [awaitInFlight],
  );

  /* ── values ────────────────────────────────────────────────────────────────────────────────── */
  const setValue = useCallback(
    <K extends WizardField>(field: K, value: CreateCompetitionFormData[K], opts?: SetValueOptions) => {
      const prev = valuesRef.current;
      const next = { ...prev, [field]: value };
      valuesRef.current = next;
      setValues(next);
      if (opts?.normalize) {
        // fish setValue without shouldDirty: a field the user had not changed moves its baseline
        // too, so the correction never counts as an edit (leave guard, auto-save).
        const base = baselineRef.current;
        if (valuesEqual({ ...base, [field]: prev[field] }, base)) markSaved({ ...base, [field]: value });
      }
      if (opts?.autoSave === 'now') void flushAutoSave();
      else if (opts?.autoSave === 'debounced') schedulerRef.current.schedule();
    },
    [flushAutoSave, markSaved],
  );

  const touch = useCallback(
    (field: WizardField) => {
      setTouched(prev => (prev.has(field) ? prev : new Set(prev).add(field)));
      void flushAutoSave();
    },
    [flushAutoSave],
  );

  const pickBanner = useCallback(
    (blob: Blob, filename?: string) => {
      const url = URL.createObjectURL(blob);
      bannerBlobs.current.set(url, { blob, filename });
      setValue('banner', url, { autoSave: 'debounced' });
    },
    [setValue],
  );
  const clearBanner = useCallback(() => setValue('banner', undefined, { autoSave: 'debounced' }), [setValue]);

  /* ── step navigation (c3, c4, c26) ─────────────────────────────────────────────────────────── */
  const goTo = useCallback(
    (pas: WizardStep) => {
      if (pas === stepFromPath(window.location.pathname)) return;
      void flushAutoSave();
      writeUrl(stepUrl(pas), false);
      window.scrollTo({ top: 0 });
    },
    [flushAutoSave, stepUrl, writeUrl],
  );
  const goNext = useCallback(() => {
    const next = WIZARD_STEP_DEFS[stepIdx + 1];
    if (next) goTo(next.slug);
  }, [goTo, stepIdx]);

  /**
   * Leave the wizard (fish dismissTo: the flow is popped, never kept under the destination): rewind
   * the step entries this wizard pushed, then replace its first entry with the target — so Back from
   * the destination never reopens a step (organizer.b.publish-landing; a deleted draft is not
   * reopened either).
   */
  const exit = useCallback(
    (target?: string) => {
      setLeaving(true);
      schedulerRef.current.cancel();
      const href = target ?? exitTarget(returnTo, competitionId);
      const depth = wizardDepth();
      if (depth <= 0) {
        router.replace(href);
        return;
      }
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        window.removeEventListener('popstate', go);
        router.replace(href);
      };
      window.addEventListener('popstate', go);
      // A browser that never reports the traversal still leaves.
      setTimeout(go, 1000);
      window.history.go(-depth);
    },
    [competitionId, returnTo, router],
  );

  /* ── the edit of a published competition (c11–c14) ─────────────────────────────────────────── */
  const invalidateCompetition = useCallback(
    (id: string) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: competitionsKeys.byId(id) }),
        qc.invalidateQueries({ queryKey: organizerKeys.dashboard }),
        qc.invalidateQueries({ queryKey: organizerKeys.competitionsRoot }),
        qc.invalidateQueries({ queryKey: competitionsKeys.registrationsListById(id) }),
        qc.invalidateQueries({ queryKey: competitionManagementKeys.allocatedParticipants(id) }),
        // fish queryKeys.competitions.standPerSectorAllocations (no core owner yet: literal key).
        qc.invalidateQueries({ queryKey: ['competitions', id, 'stand-per-sector-allocations'] }),
        qc.invalidateQueries({ queryKey: rankingsKeys.byCompetitionId(id) }),
      ]),
    [qc],
  );

  const uploadBannerForEdit = useCallback(async () => {
    const banner = valuesRef.current.banner;
    if (!isLocalBanner(banner)) return undefined;
    if (lastUploadedBannerRef.current?.url === banner) return lastUploadedBannerRef.current;
    const file = bannerBlobs.current.get(banner);
    if (!file) return undefined;
    setUploadingBanner(true);
    try {
      const uploaded = await uploadMedia(t, {
        files: [{ blob: file.blob, filename: file.filename ?? `competition_banner_${Date.now()}.jpg` }],
      });
      const first = uploaded[0] as { id?: number; documentId?: string } | undefined;
      if (!first?.id) throw new Error('Nu am putut încărca banner-ul competiției.');
      lastUploadedBannerRef.current = { url: banner, id: first.id, documentId: first.documentId };
      return lastUploadedBannerRef.current;
    } finally {
      if (mountedRef.current) setUploadingBanner(false);
    }
  }, [t]);

  /** fish persistCompetitionEdit: true when saved; a refusal opens its dialog or toasts. */
  const persistCompetitionEdit = useCallback(
    async (payload: Record<string, unknown>, confirmRiskChanges: boolean): Promise<boolean> => {
      if (!competitionId) return false;
      try {
        let body = payload;
        const banner = await uploadBannerForEdit();
        if (banner?.id) body = { ...body, bannerMediaId: banner.id, bannerMediaDocumentId: banner.documentId };
        const result = await updateCompetition.mutateAsync({ id: competitionId, data: body, confirmRiskChanges });
        void invalidateCompetition(competitionId);
        toast(getEditSavedMessage(result.meta?.allocationsReset), 'success');
        setRiskWarning(null);
        setBlockingError(null);
        return true;
      } catch (error) {
        const triage = triageEditError(error);
        if (triage.kind === 'risk') {
          setRiskWarning(triage.details);
          setBlockingError(null);
        } else if (triage.kind === 'blocking') {
          setBlockingError({ bluCode: triage.bluCode, message: triage.message });
        } else {
          toast(triage.message || SAVE_FAILED_FALLBACK_MESSAGE, 'danger');
        }
        return false;
      }
    },
    [competitionId, invalidateCompetition, toast, updateCompetition, uploadBannerForEdit],
  );

  const analyticsStep = WIZARD_STEP_DEFS[stepIdx].analytics;

  const runEditSave = useCallback(
    async (confirmRiskChanges: boolean) => {
      const payload = buildCompetitionPayload(valuesRef.current);
      try {
        startOperation('save', 20);
        const ok = await persistCompetitionEdit(payload, confirmRiskChanges);
        if (timedOutRef.current) return;
        if (ok) {
          markSaved(valuesRef.current);
          await completeOperation();
          if (!timedOutRef.current) exit();
        }
      } catch (error) {
        captureCreateCompetitionError(error, { action: 'save_draft', step: analyticsStep, draft_id: draftIdRef.current });
      } finally {
        if (!timedOutRef.current) resetOperation();
        else clearTimers();
      }
    },
    [analyticsStep, clearTimers, completeOperation, exit, markSaved, persistCompetitionEdit, resetOperation, startOperation],
  );

  /* ── save and exit (c9, c10) ───────────────────────────────────────────────────────────────── */
  const saveAndExit = useCallback(async () => {
    if (!isOnlineNow()) {
      toast(OFFLINE_ACTION_MESSAGE, 'danger');
      return;
    }
    await withOperation(async () => {
      const snapshot = valuesRef.current;
      if ((snapshot.name ?? '').trim().length < 3) {
        setNameRequired(true);
        return;
      }
      if (isEditCompetition) {
        await runEditSave(false);
        return;
      }
      const payload = buildCompetitionPayload(snapshot);
      const withBanner = hasBannerToUpload();
      const isFirstSave = !draftIdRef.current;
      try {
        startOperation('save', 25);
        const entity = await writeDraft(payload);
        if (timedOutRef.current) return;
        if (withBanner) {
          setProgress(60);
          await attachBannerIfNeeded(entity.id);
          if (timedOutRef.current) return;
        }
        markSaved(snapshot);
        await Promise.all([
          qc.invalidateQueries({ queryKey: organizerKeys.dashboard }),
          qc.invalidateQueries({ queryKey: organizerKeys.competitions('draft', 10) }),
        ]);
        if (timedOutRef.current) return;
        await completeOperation();
        if (timedOutRef.current) return;
        logCreateCompetitionDraftSaved({ is_first_save: isFirstSave, step: analyticsStep });
        exit(returnTo ?? routes.organizer());
      } catch (error) {
        captureCreateCompetitionError(error, { action: 'save_draft', step: analyticsStep, draft_id: draftIdRef.current });
        // fish rethrows here (no message); the web says why the save did not happen.
        if (!timedOutRef.current) toast((error as Error)?.message || SAVE_FAILED_FALLBACK_MESSAGE, 'danger');
      } finally {
        if (!timedOutRef.current) resetOperation();
        else clearTimers();
      }
    });
  }, [
    analyticsStep,
    attachBannerIfNeeded,
    clearTimers,
    completeOperation,
    exit,
    isEditCompetition,
    markSaved,
    qc,
    resetOperation,
    returnTo,
    runEditSave,
    setProgress,
    startOperation,
    toast,
    withOperation,
    writeDraft,
  ]);

  const confirmRiskAndSave = useCallback(async () => {
    if (!isOnlineNow()) {
      toast(OFFLINE_ACTION_MESSAGE, 'danger');
      return;
    }
    setRiskWarning(null);
    await withOperation(() => runEditSave(true));
  }, [runEditSave, toast, withOperation]);

  /* ── publish (c16–c19) ─────────────────────────────────────────────────────────────────────── */
  const askNoBanner = useCallback(
    () =>
      new Promise<boolean>(resolve => {
        noBannerResolver.current = resolve;
        setNoBannerOpen(true);
      }),
    [],
  );
  const answerNoBanner = useCallback((proceed: boolean) => {
    setNoBannerOpen(false);
    noBannerResolver.current?.(proceed);
    noBannerResolver.current = null;
  }, []);

  const publish = useCallback(async () => {
    if (!isOnlineNow()) {
      toast(OFFLINE_ACTION_MESSAGE, 'danger');
      return;
    }
    // The frame disables the button while the form cannot be published; a caller elsewhere (the
    // review step, «Reîncearcă») meets the same gate.
    if (isPublishBlocked(valuesRef.current)) return;
    await withOperation(async () => {
      if (isEditCompetition) {
        await saveAndExit();
        return;
      }
      logCreateCompetitionPublishAttempted({ draft_id: draftIdRef.current });
      if (!valuesRef.current.banner) {
        const proceed = await askNoBanner();
        if (!proceed) return;
      }
      const withBanner = hasBannerToUpload();
      try {
        startOperation('publish', 10);
        setPublishError(null);
        const entity = await writeDraft(buildCompetitionPayload(valuesRef.current));
        setProgress(35);
        if (withBanner) {
          setOperation(op => ({ ...op, statusText: getCreateCompetitionPublishStatus('banner') }));
          setProgress(50);
          await attachBannerIfNeeded(entity.id);
          setProgress(65);
        }
        setOperation(op => ({ ...op, statusText: getCreateCompetitionPublishStatus('publish'), progress: 80 }));
        const published = await publishMutation.mutateAsync(entity.documentId);
        const publishedId = published?.documentId || entity.documentId;
        if (timedOutRef.current) return;
        setProgress(100);
        logCreateCompetitionPublishSucceeded({ competition_id: publishedId, ranking_type: valuesRef.current.rankingType || 'unknown' });
        markSaved(valuesRef.current);
        await Promise.all([
          qc.invalidateQueries({ queryKey: organizerKeys.dashboard }),
          qc.invalidateQueries({ queryKey: organizerKeys.competitionsRoot }),
          qc.invalidateQueries({ queryKey: organizerKeys.competitions('notStarted', 10) }),
        ]);
        await wait(OPERATION_COMPLETION_DELAY_MS);
        if (timedOutRef.current) return;
        // organizer.b.publish-landing: the wizard is replaced; never the return target (fish preferFallback).
        exit(`${routes.competition(publishedId)}?fromPublish=1`);
      } catch (error) {
        logCreateCompetitionPublishFailed({ reason: 'api_error', draft_id: draftIdRef.current });
        captureCreateCompetitionError(error, {
          action: 'publish_draft',
          step: analyticsStep,
          draft_id: draftIdRef.current,
          ranking_type: valuesRef.current.rankingType || undefined,
        });
        if (mountedRef.current && !timedOutRef.current) {
          resetOperation();
          setPublishError((error as Error)?.message || PUBLISH_FAILED_FALLBACK_MESSAGE);
        }
      } finally {
        if (!timedOutRef.current) resetOperation();
        else clearTimers();
      }
    });
  }, [
    analyticsStep,
    askNoBanner,
    attachBannerIfNeeded,
    clearTimers,
    exit,
    isEditCompetition,
    markSaved,
    publishMutation,
    qc,
    resetOperation,
    saveAndExit,
    setProgress,
    startOperation,
    toast,
    withOperation,
    writeDraft,
  ]);

  const retryPublish = useCallback(async () => {
    setPublishError(null);
    await publish();
  }, [publish]);

  /* ── delete the draft (c7, c8) ─────────────────────────────────────────────────────────────── */
  const deleteDraft = useCallback(async () => {
    const id = draftIdRef.current;
    if (!id || isEditCompetition) return;
    if (!isOnlineNow()) {
      toast(OFFLINE_ACTION_MESSAGE, 'danger');
      return;
    }
    await withOperation(async () => {
      try {
        startOperation('delete', 30);
        await deleteMutation.mutateAsync(id);
        if (timedOutRef.current) return;
        await Promise.all([
          qc.invalidateQueries({ queryKey: organizerKeys.dashboard }),
          qc.invalidateQueries({ queryKey: organizerKeys.competitions('draft', 10) }),
          qc.invalidateQueries({ queryKey: organizerKeys.competitionsRoot }),
        ]);
        if (timedOutRef.current) return;
        await completeOperation();
        if (timedOutRef.current) return;
        toast('Ciorna a fost ștearsă.', 'success');
        exit(returnTo ?? routes.organizer());
      } catch (error) {
        captureCreateCompetitionError(error, { action: 'delete_draft', step: analyticsStep, draft_id: id });
        if (!timedOutRef.current) toast((error as Error)?.message || DELETE_FAILED_FALLBACK_MESSAGE, 'danger');
      } finally {
        if (!timedOutRef.current) resetOperation();
        else clearTimers();
      }
    });
  }, [
    analyticsStep,
    clearTimers,
    completeOperation,
    deleteMutation,
    exit,
    isEditCompetition,
    qc,
    resetOperation,
    returnTo,
    startOperation,
    toast,
    withOperation,
  ]);

  /* ── timeout recovery (c20) ────────────────────────────────────────────────────────────────── */
  const stayAfterTimeout = useCallback(() => resetOperation(), [resetOperation]);
  const leaveAfterTimeout = useCallback(() => {
    const destination = operation.recovery?.primaryDestination ?? { kind: 'organizer' as const };
    resetOperation();
    exit(destination.kind === 'competition' ? routes.competition(destination.competitionId) : routes.organizer());
  }, [exit, operation.recovery, resetOperation]);

  /* ── lake (with stands) for values.lake ────────────────────────────────────────────────────── */
  const lakeQ = useQuery(lakeQuery(t, values.lake ?? '', { enabled: Boolean(values.lake) }));
  const lake: WizardLake = {
    data: values.lake ? (lakeQ.data ?? null) : null,
    loading: Boolean(values.lake) && lakeQ.isPending,
    error: Boolean(values.lake) && lakeQ.isError,
  };

  const busy = operation.mode !== null || operation.timedOut;
  const isSaving = uploadingBanner || createDraft.isPending || updateDraft.isPending || updateCompetition.isPending;
  const mode: WizardMode = isEditCompetition ? 'edit' : draftId ? 'draft' : 'new';
  const saveLabel = getSaveActionLabel(mode !== 'new');
  const canSave = online && !busy && (values.name ?? '').trim().length >= 3;
  const completedSteps = useMemo(() => getCompletedSteps(values), [values]);
  const reviewErrs = useMemo(() => getReviewErrors(values), [values]);
  const formBlocked = useMemo(() => isPublishBlocked(values), [values]);

  const goBack = useCallback(() => {
    if (busy) return;
    const prev = WIZARD_STEP_DEFS[stepIdx - 1];
    if (prev) goTo(prev.slug);
  }, [busy, goTo, stepIdx]);

  // Test seam (never in a production build): tests/e2e/organizator-asistent.spec.ts drives the form
  // through it while the steps are stubs, and asserts the frame's behaviour on real values.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const w = window as unknown as { __bluviWizard?: unknown };
    w.__bluviWizard = { setValue, touch, pickBanner, values: () => valuesRef.current };
    return () => {
      delete w.__bluviWizard;
    };
  }, [pickBanner, setValue, touch]);

  const internals: WizardInternals = {
    operation,
    publishBlocked: formBlocked || publishBlocked,
    completedSteps,
    returnTo,
    isSaving,
    nameRequired,
    dismissNameRequired: () => setNameRequired(false),
    riskWarning,
    dismissRiskWarning: () => setRiskWarning(null),
    confirmRiskAndSave,
    blockingError,
    dismissBlockingError: () => setBlockingError(null),
    publishError,
    dismissPublishError: () => setPublishError(null),
    retryPublish,
    noBannerOpen,
    answerNoBanner,
    deleteDraft,
    exit,
    stayAfterTimeout,
    leaveAfterTimeout,
    leaving,
  };

  const value = {
    mode,
    values,
    errors,
    touched,
    setValue,
    touch,
    flushAutoSave,
    goTo,
    goNext,
    goBack,
    step,
    stepIndex: stepIdx,
    saveLabel,
    canSave,
    saveAndExit,
    publish,
    lake,
    busy,
    online,
    dirty,
    competitionId: competitionId ?? undefined,
    draftId: draftId ?? undefined,
    autoSave,
    pickBanner,
    clearBanner,
    query,
    setQuery,
    setPublishBlocked,
    reviewErrors: reviewErrs,
    fieldIds: WIZARD_FIELD_IDS,
    internals,
  };

  return <WizardContext value={value}>{children}</WizardContext>;
}
