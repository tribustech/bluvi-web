'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { fishesQuery } from '@/core/lakes';
import {
  anchorCoord,
  applyTimePick,
  atLeast,
  buildCaptureDetails,
  computeBaitHistory,
  decideCaptureSave,
  distanceFromAnchor,
  eventPhotoUri,
  haversineMeters,
  LANE_LABEL,
  laneForRod,
  MIN_CURTAIN_MS,
  pad2,
  resolveDefaultTargets,
  sameSpecies,
  sortCatalog,
  speciesKey,
  toCatalogFish,
  type BaitValue,
  type LocalEvent,
  type LocalSession,
  type RodRuntime,
  type TargetSpecies,
} from '@/core/partide';
import { currentRev, eventPresent, eventUpdatedSince, revAdvanced, waitForProjection } from '@/core/realtime/partide/live';
import { invalidateAfterCaptureSaved, logCapture, resolveRodCapture, setTargetSpecies, updateCapture, type CaptureWriteContext } from '@/components/partide/capture';
import { ANCHOR_ZOOM, COUNTRY_ZOOM, MapPointPicker, ROMANIA_CENTER } from '@/components/partide/map/MapPointPicker';
import { SpeciesPicker } from '@/components/partide/species/SpeciesPicker';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { compressImage } from '@/lib/client/compress-image';
import { canGoBackInApp } from '@/lib/client/in-app-history';
import { partideHrefs } from '@/lib/partide-pages';
import { routes } from '@/lib/routes';
import { useSiteToast } from '../../../../_shell/Toast';
import { liveClock, OFFLINE_WRITE_MESSAGE, useLivePartide, useOnline } from '../../../_live';
import { PhotoPreviewDialog } from '../_photo/PhotoPreviewDialog';
import { BaitEditor } from './BaitEditor';
import { DetailsRows } from './DetailsRows';
import { BAR_INNER, COLUMN } from './layout';
import { RodChooser } from './RodChooser';
import { SaveCurtain, type CurtainOrigin } from './SaveCurtain';
import { saveCurtainMessages } from './saveCurtainCopy';
import { SpeciesChips } from './SpeciesChips';
import { TimePicker } from './TimePicker';
import { WeightCard } from './WeightKeypad';

/*
 * «Captură nouă» / «Editează captura» (parity partide.captura; fish app/(app)/partide/captura.tsx,
 * T6 single-task flow). The form is seeded ONCE from the live session when it mounts (a background
 * snapshot must not re-seed it); the live session keeps feeding the targets, the rods and the
 * roster.
 *
 * Save (c9–c12) mirrors fish's matrix: an edit patches only what changed (photo only when changed,
 * the rod snapshot only when the rod changed) and waits for the projection to echo its
 * clientUpdatedAt; a new capture is logged (no rod, an idle / ready rod, or «Continuă» on a running
 * one) and waits for the event to appear, or resolves the rod's cycle (an expired rod, or «Oprește»)
 * and waits for the projection rev to move. The curtain stays up at least MIN_CURTAIN_MS; a failure
 * drops it, shows «Nu am putut salva captura. Încearcă din nou.» and the button becomes
 * «Reîncearcă», which replays the SAME event id. Offline: «Fără conexiune. Reconectare…», no write.
 * On success: the angler galleries and the partidă detail are invalidated, the projection is
 * awaited (≤ 2,5 s — a presentation fallback, the HTTP answer decided success), then back.
 */

const HERO_EMPTY_MS = 190;
const SAVE_ERROR = 'Nu am putut salva captura. Încearcă din nou.';
const PHOTO_ERROR = 'Nu am putut pregăti poza. Încearcă din nou.';
const IDLE: RodRuntime = { phase: 'idle', endEpoch: null };

const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

type Photo = { url: string | null; blob: Blob | null };
type Surface = 'rod' | 'species' | 'bait' | 'time' | 'map' | 'photoChoice' | null;

export function CaptureForm({
  documentId,
  session,
  rodParam,
  editEvent,
}: {
  documentId: string;
  session: LocalSession;
  rodParam: number | null;
  /** The capture being edited, resolved once by CaptureScreen (an unknown `editare` id → null: a new capture). */
  editEvent: LocalEvent | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const live = useLivePartide();
  const online = useOnline();
  const toast = useSiteToast();

  // Edit mode: prefill from the tapped capture (fish: a missing id → a new capture).
  const isEdit = editEvent !== null;

  const rods = session.rods;
  const runtimes = useMemo(() => session.rods.map((_, i) => session.rodRuntimes[i] ?? IDLE), [session]);
  const anchor = anchorCoord(session.anchorLat, session.anchorLng);

  // ── species ─────────────────────────────────────────────────────────────────
  // «Mai mult» saves the new list on the session; until the projection echoes it, the chips show it.
  // An EMPTY list falls back to the catalog defaults at once (fish: its atom updates optimistically).
  const [targetsOverride, setTargetsOverride] = useState<{ base: TargetSpecies[]; next: TargetSpecies[] } | null>(null);
  const pendingOverride = targetsOverride && targetsOverride.base === session.targetSpecies ? targetsOverride.next : null;
  const catalogQuery = useQuery({ ...fishesQuery(live.transport), enabled: (pendingOverride ?? session.targetSpecies).length === 0 });
  const catalog = useMemo(() => (catalogQuery.data ? sortCatalog(catalogQuery.data.map(toCatalogFish)) : []), [catalogQuery.data]);
  const targets = useMemo<TargetSpecies[]>(() => {
    const list = pendingOverride ?? session.targetSpecies;
    return list.length ? list : resolveDefaultTargets(catalog);
  }, [pendingOverride, session.targetSpecies, catalog]);

  // ── form state ──────────────────────────────────────────────────────────────
  const [selectedIndex, setSelectedIndex] = useState<number | null>(() => (editEvent ? editEvent.rodIndex : rodParam != null && rods.some(r => r.index === rodParam) ? rodParam : null));
  const [weight, setWeight] = useState<number | null>(editEvent ? editEvent.weightKg : null);
  const [weightEstimated, setWeightEstimated] = useState(editEvent?.weightEstimated ?? false);
  const [species, setSpecies] = useState<TargetSpecies>(() => (editEvent ? { id: editEvent.speciesId, name: editEvent.species ?? 'Altele' } : targets[0]));
  // null = momeală untouched (the rod snapshot applies); non-null = explicit edit.
  const [baitEdit, setBaitEdit] = useState<BaitValue | null>(() =>
    editEvent ? { bait: editEvent.bait, baitType: editEvent.baitType, baitSize: editEvent.baitSize, baitFlavor: editEvent.baitFlavor } : null,
  );
  const [photo, setPhoto] = useState<Photo>(() => ({ url: editEvent ? eventPhotoUri(editEvent) : null, blob: null }));
  const [initialPhotoUrl] = useState(photo.url);
  // null = «Toți» (everyone).
  const [photoTagUids, setPhotoTagUids] = useState<string[] | null>(() => editEvent?.photoTagUids ?? null);
  const [coord, setCoord] = useState<{ lat: number; lng: number } | null>(() =>
    editEvent && editEvent.lat != null && editEvent.lng != null ? { lat: editEvent.lat, lng: editEvent.lng } : null,
  );
  const [pickedDistance, setPickedDistance] = useState<number | null>(null);
  // null = «acum» (stamped at save); a number = an explicit «Ora» pick / the edited event's time.
  const [occurredAtMs, setOccurredAtMs] = useState<number | null>(editEvent ? editEvent.occurredAt : null);
  const [mountedAtMs] = useState(() => Date.now());

  const [surface, setSurface] = useState<Surface>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [previewSource, setPreviewSource] = useState<Blob | null>(null);
  const [ask, setAsk] = useState<{ rodLabel: string; onContinue: () => void; onStop: () => void } | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const retryCaptureIdRef = useRef<string | null>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [heroRect, setHeroRect] = useState<CurtainOrigin | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Object URLs we minted are released when replaced and on unmount.
  const ownUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = ownUrls.current;
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, []);

  const activeRod = selectedIndex != null ? (rods.find(r => r.index === selectedIndex) ?? null) : null;
  // The display/snapshot lane is DERIVED for map-placed rods; null = no honest lane.
  const activeRodLane = activeRod ? laneForRod(rods, activeRod, anchor) : null;

  // A NEW capture on a rod with a placed cast pin starts at that pin (c6); editing never moves an old catch.
  const rodPin = activeRod?.castLat != null && activeRod?.castLng != null ? { lat: activeRod.castLat, lng: activeRod.castLng } : null;
  const effectiveCoord = coord ?? (isEdit ? null : rodPin);
  const derivedDistance = pickedDistance ?? (effectiveCoord && anchor ? distanceFromAnchor(anchor, effectiveCoord) : null);

  // Reconcile (derived, never stored): a selected species that fell out of the targets shows — and
  // saves — as the first target; the same fish under another id takes the target's id. «Altele» and
  // edits keep theirs (SpeciesChips then shows it as its own chip).
  const shownSpecies = useMemo<TargetSpecies>(() => {
    if (isEdit || species.name === 'Altele' || !targets.length) return species;
    return targets.find(t => sameSpecies(t, species)) ?? targets[0];
  }, [isEdit, species, targets]);

  // ── labels ──────────────────────────────────────────────────────────────────
  const baitLabel = baitEdit ? baitEdit.bait : (activeRod?.bait ?? '');
  const baitInitial: BaitValue | null = baitEdit ?? (activeRod ? { bait: activeRod.bait, baitType: activeRod.baitType, baitSize: activeRod.baitSize, baitFlavor: activeRod.baitFlavor } : null);
  // Metres only from a real stand / start pin: a legacy 0/0 anchor has none (owner rule 4 — fish
  // measures from the Gulf of Guinea there), and the saved event carries no distance either.
  const pinMeters = effectiveCoord && anchor ? `${Math.round(haversineMeters(anchor, effectiveCoord))} m` : null;
  const pinDistanceLabel = effectiveCoord
    ? coord
      ? pinMeters
        ? `${pinMeters} · pe hartă`
        : 'pe hartă'
      : pinMeters
        ? `la pinul lansetei · ${pinMeters}`
        : 'la pinul lansetei'
    : null;
  const rodPlaceLabel = activeRod ? `${activeRodLane ? `${LANE_LABEL[activeRodLane]} · ` : ''}${activeRod.distance} m` : null;
  const timeLabel = hhmm(occurredAtMs ?? mountedAtMs);
  const baitHistory = useMemo(() => computeBaitHistory(Object.values(live.state.sessions), Object.values(live.state.events)), [live.state.sessions, live.state.events]);
  // The preview's tag picker reads the roster as the session carries it (core SessionMember).
  const members = useMemo(() => session.members ?? [], [session.members]);

  // ── actions ─────────────────────────────────────────────────────────────────
  const chooseRod = (idx: number | null) => {
    setSelectedIndex(idx);
    // A rod change resets an explicit bait edit so the new rod's snapshot shows (c6).
    setBaitEdit(null);
    setSurface(null);
  };

  const ctx: CaptureWriteContext = { live, queryClient, documentId, sessionClientId: session.clientId };

  const handleSpeciesSave = (next: TargetSpecies[]) => {
    const prevKeys = new Set(targets.map(speciesKey));
    const added = next.find(t => !prevKeys.has(speciesKey(t)));
    setTargetsOverride({ base: session.targetSpecies, next });
    void setTargetSpecies(ctx, next);
    if (added) setSpecies(added);
  };

  const leave = useCallback(() => {
    if (canGoBackInApp()) router.back();
    else router.replace(partideHrefs.partida(documentId) ?? routes.partide());
  }, [documentId, router]);

  // ── photo ───────────────────────────────────────────────────────────────────
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const pickPhoto = () => {
    // fish: «Fă o poză» / «Alege din galerie» / «Anulează». A touch screen gets the same choice; a
    // desktop opens the file picker straight away (no camera to choose).
    const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
    if (coarse) setSurface('photoChoice');
    else galleryInput.current?.click();
  };
  // Whether the open preview re-shows the ATTACHED photo (vs a freshly picked one): an uncropped
  // reopen keeps the photo as it is — no new object URL, so no re-upload and no `photo` on an edit
  // (fish photo-preview hands back the same workingUri; captura sends `photo` only when it moved).
  const previewIsReopen = useRef(false);
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    previewIsReopen.current = false;
    setSurface(null);
    setPreparingPhoto(true);
    try {
      const prepared = await compressImage(file);
      if (!mountedRef.current) return;
      setPreviewSource(prepared);
    } catch {
      toast(PHOTO_ERROR, 'danger');
    } finally {
      if (mountedRef.current) setPreparingPhoto(false);
    }
  };
  // An attached photo reopens the preview (crop + tags) with the current working image.
  const reopenPhoto = async () => {
    previewIsReopen.current = true;
    if (photo.blob) return setPreviewSource(photo.blob);
    if (!photo.url) return;
    setPreparingPhoto(true);
    try {
      const res = await fetch(photo.url);
      if (!res.ok) throw new Error(String(res.status));
      setPreviewSource(await res.blob());
    } catch {
      toast(PHOTO_ERROR, 'danger');
    } finally {
      if (mountedRef.current) setPreparingPhoto(false);
    }
  };
  const setOwnPhoto = (blob: Blob | null) => {
    setPhoto(prev => {
      if (prev.url && ownUrls.current.has(prev.url)) {
        URL.revokeObjectURL(prev.url);
        ownUrls.current.delete(prev.url);
      }
      if (!blob) return { url: null, blob: null };
      const url = URL.createObjectURL(blob);
      ownUrls.current.add(url);
      return { url, blob };
    });
  };

  // ── save ────────────────────────────────────────────────────────────────────
  const finishSave = async (committed: Promise<void>, confirmed: () => boolean) => {
    setSaveError(null);
    const r = heroRef.current?.getBoundingClientRect();
    setHeroRect(r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null);
    setSaving(true);
    try {
      await atLeast(committed, MIN_CURTAIN_MS);
    } catch (e) {
      console.error('[captura] save failed', e);
      if (!mountedRef.current) return;
      setSaving(false);
      setSaveError(SAVE_ERROR);
      return;
    }
    // Saved for good — the next save on this screen is a new catch again.
    retryCaptureIdRef.current = null;
    invalidateAfterCaptureSaved(queryClient, documentId);
    await waitForProjection(live.subscribeState, confirmed);
    if (!mountedRef.current) return;
    leave();
  };

  const onSave = () => {
    if (saving) return;
    if (!online) {
      setSaveError(OFFLINE_WRITE_MESSAGE);
      return;
    }
    const photoChanged = photo.url !== initialPhotoUrl;

    if (editEvent) {
      const stampedAt = Date.now();
      const committed = updateCapture(
        ctx,
        editEvent.clientId,
        {
          weightKg: weight,
          weightEstimated: weight == null ? false : weightEstimated,
          species: shownSpecies.name,
          speciesId: shownSpecies.id,
          ...(baitEdit ? { bait: baitEdit.bait, baitType: baitEdit.baitType, baitSize: baitEdit.baitSize, baitFlavor: baitEdit.baitFlavor } : {}),
          lat: effectiveCoord?.lat ?? null,
          lng: effectiveCoord?.lng ?? null,
          ...(derivedDistance != null ? { distance: derivedDistance } : {}),
          ...(occurredAtMs != null ? { occurredAt: occurredAtMs } : {}),
          // Only a real change touches the photo — the prefilled url may be the remote upload.
          ...(photoChanged ? { photo: { localUri: photo.url } } : {}),
          photoTagUids,
          // Only re-attribute when the rod moved; an untouched rod keeps the event's snapshot.
          ...(selectedIndex !== editEvent.rodIndex
            ? {
                rod: activeRod
                  ? {
                      index: activeRod.index,
                      label: activeRod.label,
                      color: activeRod.color,
                      bait: activeRod.bait,
                      baitType: activeRod.baitType,
                      baitSize: activeRod.baitSize,
                      baitFlavor: activeRod.baitFlavor,
                      lane: activeRodLane,
                      distance: activeRod.distance,
                    }
                  : null,
              }
            : {}),
        },
        { stampedAt, photoFile: photo.blob },
      );
      void finishSave(committed, eventUpdatedSince(live.read, editEvent.clientId, stampedAt));
      return;
    }

    const revBefore = currentRev(live.read, session.clientId);
    const { log, resolve } = buildCaptureDetails({
      // Snapshot the derived lane so the saved event reflects what the card shows.
      rod: activeRod ? { ...activeRod, lane: activeRodLane ?? activeRod.lane } : null,
      weightKg: weight,
      weightEstimated: weight == null ? false : weightEstimated,
      species: shownSpecies,
      baitEdit,
      photoLocalUri: photo.url,
      photoTagUids,
      coord: effectiveCoord,
      distance: derivedDistance,
      occurredAtMs,
    });
    const doLog = () => {
      const { clientId, committed } = logCapture(ctx, log, { retryClientId: retryCaptureIdRef.current ?? undefined, photoFile: photo.blob });
      // Remember the id this attempt used so a «Reîncearcă» replays it.
      retryCaptureIdRef.current = clientId;
      void finishSave(committed, eventPresent(live.read, clientId));
    };
    const doResolve = (rodIndex: number) =>
      // The resolve branch mints its event id inside the cycle, so a rev bump is the honest signal.
      void finishSave(resolveRodCapture(ctx, rodIndex, resolve, { photoFile: photo.blob }), revAdvanced(live.read, session.clientId, revBefore));

    const rodIndex = activeRod?.index ?? null;
    const decision = decideCaptureSave(rodIndex, runtimes, liveClock.now());
    if (rodIndex == null || decision.action === 'log') return doLog();
    if (decision.action === 'resolve') return doResolve(rodIndex);
    setAsk({
      rodLabel: String(rodIndex),
      onContinue: () => {
        setAsk(null);
        doLog();
      },
      onStop: () => {
        setAsk(null);
        doResolve(rodIndex);
      },
    });
  };

  // ── hero entrance ───────────────────────────────────────────────────────────
  const [poured, setPoured] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setPoured(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const title = isEdit ? 'Editează captura' : 'Captură nouă';
  const curtainMessages = useMemo(() => saveCurtainMessages(isEdit ? 'catchEdit' : 'catch', { hasPhoto: !!photo.url }), [isEdit, photo.url]);
  const buttonLabel = saveError ? 'Reîncearcă' : isEdit ? 'Salvează modificările' : 'Salvează captura';
  const pickerCenter = effectiveCoord ?? anchor ?? null;

  return (
    <div data-testid="capture-form" data-mode={isEdit ? 'edit' : 'new'} className="flex min-h-[calc(100dvh-(--spacing(14)))] flex-col md:min-h-[calc(100dvh-(--spacing(26)))]">
      <div className={cn(COLUMN, 'flex flex-1 flex-col pb-6 xl:flex-none')}>
        {/* ── hero (indigo) ── the save curtain opens out of exactly this rect. */}
        <header
          ref={heroRef}
          data-testid="capture-hero"
          className="rounded-b-bento bg-accent px-5 pt-3 pb-5.5 text-on-accent shadow-glow md:rounded-bento md:px-6 md:pt-5 md:pb-6"
        >
          <div
            className={cn(
              'flex flex-col gap-1 transition-[opacity,translate] duration-(--duration-slow) ease-slow motion-reduce:transition-none',
              poured && !saving ? 'translate-y-0 opacity-100' : saving ? 'opacity-0' : 'translate-y-2 opacity-0',
            )}
            style={saving ? { transitionDuration: `${HERO_EMPTY_MS}ms` } : undefined}
          >
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={leave}
                aria-label="Înapoi"
                className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-on-accent/20 transition-colors duration-(--duration-fast) hover:bg-on-accent/30"
              >
                <ChevronLeftIcon aria-hidden className="size-5 stroke-[2.4]" />
              </button>
              <h1 className="t-title2 md:t-title1" data-testid="capture-title">
                {title}
              </h1>
            </div>
            <p className="pl-12.5 t-caption font-semibold">Completează datele pentru o statistică personală cât mai completă.</p>
          </div>
        </header>

        <div className="flex flex-col gap-4.5 px-4 pt-4.5 md:px-0 md:pt-6">
          <section aria-labelledby="capture-species-label" className="flex flex-col gap-2.5">
            <h2 id="capture-species-label" className="pl-1 t-eyebrow text-muted uppercase">
              Ce ai prins?
            </h2>
            <SpeciesChips targets={targets} selected={shownSpecies} onSelect={setSpecies} onMore={() => setSurface('species')} />
          </section>

          <section aria-labelledby="capture-weight-label" className="flex flex-col gap-2.5">
            <h2 id="capture-weight-label" className="pl-1 t-eyebrow text-muted uppercase">
              Greutate
            </h2>
            <WeightCard weight={weight} estimated={weightEstimated} onWeight={setWeight} onEstimated={setWeightEstimated} />
          </section>

          <section aria-labelledby="capture-details-label" className="flex flex-col gap-2.5">
            <h2 id="capture-details-label" className="pl-1 t-eyebrow text-muted uppercase">
              Detalii
            </h2>
            <DetailsRows
              model={{
                rodLabel: activeRod ? activeRod.label || `Lanseta ${activeRod.index}` : 'Fără lansetă',
                placeLabel: pinDistanceLabel ?? rodPlaceLabel ?? 'Alege pe hartă',
                placeIsPrompt: !pinDistanceLabel && !rodPlaceLabel,
                hasPlace: !!effectiveCoord,
                baitLabel,
                photoUrl: photo.url,
                photoPreparing: preparingPhoto,
                timeLabel: occurredAtMs != null ? timeLabel : `acum · ${timeLabel}`,
              }}
              onRod={() => setSurface('rod')}
              onPlace={() => setSurface('map')}
              onBait={() => setSurface('bait')}
              onPhoto={() => (photo.url ? void reopenPhoto() : pickPhoto())}
              onRemovePhoto={() => setOwnPhoto(null)}
              onTime={() => setSurface('time')}
            />
          </section>
        </div>
      </div>

      {/* ── the action bar: docked edge to edge below 1280; from 1280 a card IN THE FLOW right under
           «DETALII» (= T4ActionBar) — never floating over the form rows. */}
      <div className="sticky bottom-0 z-sticky xl:static xl:pb-10">
        <div className="border-t border-hairline bg-surface shadow-tabbar xl:mx-auto xl:max-w-180 xl:rounded-card xl:border-t-0 xl:shadow-[var(--shadow-e1),var(--shadow-e0)]">
          <div className={cn(BAR_INNER, 'flex flex-col gap-2.5 px-4 pt-3 pb-[max(--spacing(3),env(safe-area-inset-bottom))] md:px-6 xl:px-6 xl:py-4')}>
            {saveError ? (
              <p role="alert" data-testid="capture-save-error" className="text-center t-caption font-semibold text-status-danger-fg">
                {saveError}
              </p>
            ) : null}
            <Button type="button" block data-testid="capture-save" aria-busy={saving || undefined} onClick={onSave}>
              {buttonLabel}
            </Button>
          </div>
        </div>
      </div>

      {/* Hidden pickers: the camera (capture) and the gallery. */}
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden data-testid="photo-camera-input" onChange={e => void onFile(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
      <input ref={galleryInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden data-testid="photo-input" onChange={e => void onFile(e.target.files?.[0]).finally(() => (e.target.value = ''))} />

      <RodChooser open={surface === 'rod'} rods={rods} selected={selectedIndex} onChoose={chooseRod} onClose={() => setSurface(null)} />
      <SpeciesPicker
        open={surface === 'species'}
        initial={targets}
        includeAltele
        onSave={handleSpeciesSave}
        // «Altele»: this capture only — the session's targets are left untouched.
        onPickAltele={() => setSpecies({ id: null, name: 'Altele' })}
        onClose={() => setSurface(null)}
      />
      <BaitEditor open={surface === 'bait'} initial={baitInitial} history={baitHistory} onSave={setBaitEdit} onClose={() => setSurface(null)} />
      <TimePicker
        open={surface === 'time'}
        valueMs={occurredAtMs ?? mountedAtMs}
        onDone={picked => setOccurredAtMs(applyTimePick(occurredAtMs ?? Date.now(), picked, Date.now()))}
        onClose={() => setSurface(null)}
      />
      <MapPointPicker
        open={surface === 'map'}
        title="Poziția pe hartă"
        center={pickerCenter ?? ROMANIA_CENTER}
        initialZoom={pickerCenter ? ANCHOR_ZOOM - 0.5 : COUNTRY_ZOOM}
        initialMapType={pickerCenter ? 'satellite' : 'standard'}
        onCancel={() => setSurface(null)}
        onConfirm={c => {
          setCoord(c);
          // 5 m rounding, matching the rod-config semantics; measured from the stand / start pin.
          setPickedDistance(anchor ? distanceFromAnchor(anchor, c) : null);
          setSurface(null);
        }}
      />
      <ResponsiveSurface
        open={surface === 'photoChoice'}
        onClose={() => setSurface(null)}
        intent="decision"
        title="Adaugă o poză"
        sheetSnap="fit"
        actions={
          <div className="flex w-full flex-col gap-2">
            <Button type="button" block onClick={() => cameraInput.current?.click()}>
              Fă o poză
            </Button>
            <Button type="button" block variant="secondary" onClick={() => galleryInput.current?.click()}>
              Alege din galerie
            </Button>
            <Button type="button" block variant="ghost" onClick={() => setSurface(null)}>
              Anulează
            </Button>
          </div>
        }
      >
        {null}
      </ResponsiveSurface>
      {previewSource ? (
        <PhotoPreviewDialog
          open
          source={previewSource}
          members={members}
          initialTags={photoTagUids}
          onDone={({ blob, tags, changed }) => {
            if (changed || !previewIsReopen.current) setOwnPhoto(blob);
            setPhotoTagUids(tags);
            setPreviewSource(null);
          }}
          onCancel={() => setPreviewSource(null)}
        />
      ) : null}
      <ResponsiveSurface
        open={ask != null}
        onClose={() => setAsk(null)}
        intent="decision"
        title="Lanseta cronometrează"
        sheetSnap="fit"
        actions={
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:justify-end">
            <Button type="button" variant="outline" onClick={() => ask?.onContinue()}>
              Continuă
            </Button>
            <Button type="button" variant="danger" data-testid="rod-running-stop" onClick={() => ask?.onStop()}>
              Oprește
            </Button>
          </div>
        }
      >
        <p data-testid="rod-running-ask" className="t-body text-ink-2">
          Oprești cronometrul Lansetei {ask?.rodLabel}?
        </p>
      </ResponsiveSurface>

      {preparingPhoto ? (
        <div data-testid="photo-preparing" className="fixed inset-0 z-overlay flex flex-col items-center justify-center gap-3.5 bg-surface/90">
          <span aria-hidden className="size-9 animate-spin rounded-full border-3 border-accent-tint-2 border-t-accent motion-reduce:animate-none" />
          <p role="status" className="t-body-strong text-ink-2">
            Se pregătește poza…
          </p>
        </div>
      ) : null}

      <SaveCurtain visible={saving} messages={curtainMessages} from={heroRect} enterDelayMs={HERO_EMPTY_MS} />
    </div>
  );
}
