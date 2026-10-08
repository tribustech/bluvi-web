'use client';

import { FilmIcon, PhotoIcon, ShareIcon } from '@heroicons/react/24/outline';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSiteToast } from '@/app/(site)/_shell/Toast';
// The lake gallery's masonry and catch tile, read-only (their TODO(kit): a Masonry in components/ui).
import { CatchTile } from '@/app/(site)/balti/[id]/_sub/CatchTile';
import { DEFAULT_RATIO, MasonryGrid, MasonrySkeleton, tileRatio } from '@/app/(site)/balti/[id]/_sub/Masonry';
import { ShareCatchSheet, type ShareCatchTarget } from '@/components/partide/share/ShareCatchSheet';
import { Lightbox, type LightboxItem } from '@/components/surfaces/Lightbox';
import { T2Spinner } from '@/components/templates/T2';
import { cn } from '@/components/ui/cn';
import { eventPhotoUri, fmtClock, fmtKg, type LocalEvent } from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';
import { venueName } from '../../model';
import type { MemberTabProps } from '../types';
import { exportGalleryGif } from './gifExport';
import { galleryCaption, galleryCatches, gifFileName, gifItems, gridPhoto } from './model';

/*
 * The member view's «Galerie» tab (parity partide.partida-galerie; fish
 * features/partide/scenes/GalerieScene.tsx, components/community/MasonryGallery.tsx,
 * helpers/gifExport.ts, components/ImageLightbox.tsx + CatchLightboxFooter.tsx). Works off the
 * frame's events, so it covers a live partidă (the realtime projection) and an ended one (the CMS
 * detail) alike.
 *
 *  - c1 only captures with a photo, newest first, in the lake gallery's masonry (two columns on a
 *    phone, ~220px tracks as the page widens); each tile the catch signature (CatchTile caption:
 *    the navy kg chip, then the species — web's fish CatchCard language, where fish's tile prints
 *    one white «{specie} · {kg} kg» line) and named «{specie} · {kg} kg». No layout shift: the
 *    tiles are placed only once their photos' ratios are known (useSettledRatios — a skeleton until
 *    then, time-boxed), and a ratio, once used, never changes;
 *  - c2 no photo → fish's two lines;
 *  - c3 a tile opens the kit Lightbox on it, with fish's CatchLightboxFooter (the big kg, «specie ·
 *    ora»); «Distribuie captura» closes the lightbox and opens the composed share card
 *    (ShareCatchSheet) for that catch;
 *  - c4 from two photos «Exportă GIF» (fish's floating pill on the phone — sticky to the bottom
 *    edge while the grid is in view —, the toolbar's action from 768) draws every photo catch into a
 *    GIF frame client-side (./gifExport), «{done}/{total}» while it works (a second tap cancels),
 *    then by DEVICE, not capability (desktop browsers say canShare({files}) too): a fine pointer
 *    from 768 downloads («GIF-ul a fost salvat.»), a touch screen gets the system share sheet. The
 *    build outlives the tap's transient activation (iOS Safari, Chrome: share() → NotAllowedError),
 *    so a refused share keeps the GIF and the action turns into «Distribuie GIF-ul» — a fresh tap
 *    — and a second refusal downloads it; the user closing the sheet (AbortError) is the only
 *    silent outcome. Failure (fewer than two photos load, a tainted canvas) → «Eroare la generarea
 *    GIF-ului».
 */

/*
 * A photo's ratio, FIXED the first time it is known — measured from the loaded photo, or 4:3 when it
 * fails or has not loaded within SETTLE_MS — and kept across remounts (fish MasonryGallery
 * measuredRatios). Never revised: a ratio the masonry placed a tile with stays its ratio, so a late
 * photo can never move the grid (live Firestore events carry no dimensions).
 */
const fixedRatios = new Map<string, number>();
const SETTLE_MS = 1500;

/**
 * The fixed ratios of `urls` (each loads once to measure). `settled`: every url had its ratio once
 * — until then the tab shows the skeleton, so the first placement is the final one; a photo arriving
 * later (a live capture) joins the grid when its own ratio is fixed (`isFixed`).
 */
function useSettledRatios(urls: string[]) {
  const [, bump] = useState(0);
  const key = urls.join('\n');
  useEffect(() => {
    const pending = (key ? key.split('\n') : []).filter(url => !fixedRatios.has(url));
    if (!pending.length) return;
    let live = true;
    const fix = (url: string, ratio: number) => {
      if (fixedRatios.has(url)) return;
      fixedRatios.set(url, ratio);
      if (live) bump(n => n + 1);
    };
    const imgs = pending.map(url => {
      const img = new Image();
      img.onload = () => fix(url, img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : DEFAULT_RATIO);
      img.onerror = () => fix(url, DEFAULT_RATIO);
      img.src = url;
      return img;
    });
    const timer = setTimeout(() => pending.forEach(url => fix(url, DEFAULT_RATIO)), SETTLE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
      for (const img of imgs) img.onload = img.onerror = null;
    };
  }, [key]);
  const allFixed = urls.every(url => fixedRatios.has(url));
  const [settled, setSettled] = useState(allFixed);
  if (allFixed && !settled) setSettled(true);
  return { settled, isFixed: (url: string) => fixedRatios.has(url), ratioOf: (url: string) => fixedRatios.get(url) ?? DEFAULT_RATIO };
}

/** A fine pointer on a wide screen (a desktop): the GIF is downloaded, a touch screen shares it. */
const prefersDownload = () => typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine) and (min-width: 768px)').matches;

const canShareFile = (file: File) => typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

/** The system share sheet: 'done' when shared or dismissed (AbortError), 'refused' otherwise (NotAllowedError: no activation left). */
async function shareFile(file: File): Promise<'done' | 'refused'> {
  try {
    await navigator.share({ files: [file], title: 'Distribuie GIF-ul' });
    return 'done';
  } catch (err) {
    if ((err as { name?: string } | null)?.name === 'AbortError') return 'done';
    console.warn('[partide gif] share refused', err);
    return 'refused';
  }
}

const toTarget = (e: LocalEvent): ShareCatchTarget => ({
  key: e.clientId,
  photoUrl: eventPhotoUri(e),
  weightKg: e.weightKg,
  species: e.species,
  occurredAt: new Date(e.occurredAt).toISOString(),
});

const ROUND =
  'flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-photo-scrim hover:bg-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-photo-scrim';

export default function GalerieTab({ session, events }: MemberTabProps) {
  const toast = useSiteToast();
  const catches = useMemo(() => galleryCatches(events), [events]);
  const urls = useMemo(() => catches.map(gridPhoto), [catches]);
  const ratios = useSettledRatios(urls);
  const shown = ratios.settled ? catches.filter(e => ratios.isFixed(gridPhoto(e))) : [];
  const [openId, setOpenId] = useState<string | null>(null);
  const [sharing, setSharing] = useState<LocalEvent | null>(null);
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  // A built GIF whose share the browser refused (the tap's activation expired during the build):
  // it waits for a fresh tap — for this set of photos only.
  const [ready, setReady] = useState<{ file: File; key: string } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const name = venueName(session);
  const photosKey = urls.join('\n');
  const readyFile = ready && ready.key === photosKey ? ready.file : null;
  useEffect(() => () => abort.current?.abort(), []);

  // The lightbox follows the catch, not the index: a capture arriving live never moves it.
  const found = openId ? catches.findIndex(e => e.clientId === openId) : -1;
  const items = useMemo<LightboxItem[]>(
    () => catches.map(e => ({ key: e.clientId, src: eventPhotoUri(e) as string, preview: gridPhoto(e), alt: galleryCaption(e) ?? 'Captură' })),
    [catches],
  );
  const target = useMemo(() => (sharing ? toTarget(sharing) : null), [sharing]);

  const saveFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast('GIF-ul a fost salvat.', 'success');
  };

  const exportGif = async () => {
    if (catches.length < 2) return;
    const frames = gifItems(session, catches);
    if (frames.length < 2) return;
    const controller = new AbortController();
    abort.current = controller;
    setReady(null);
    setProgress({ done: 0, total: frames.length });
    try {
      const family = getComputedStyle(document.body).fontFamily || 'sans-serif';
      await document.fonts?.load(`800 40px ${family}`).catch(() => undefined);
      const blob = await exportGalleryGif(frames, { family, signal: controller.signal, onProgress: (done, total) => setProgress({ done, total }) });
      const file = new File([blob], gifFileName(Date.now()), { type: 'image/gif' });
      setProgress(null);
      if (prefersDownload() || !canShareFile(file)) return saveFile(file);
      if ((await shareFile(file)) === 'refused') setReady({ file, key: photosKey });
    } catch (err) {
      if (controller.signal.aborted) return; // cancelled: a second tap, or the tab went away
      console.error('[partide gif]', err);
      toast('Eroare la generarea GIF-ului', 'danger');
    } finally {
      if (abort.current === controller) abort.current = null;
      setProgress(null);
    }
  };

  /** The fresh tap on «Distribuie GIF-ul»: the share sheet again; refused again → the download. */
  const shareReady = async (file: File) => {
    setReady(null);
    if ((await shareFile(file)) === 'refused') saveFile(file);
  };

  const onGif = () => {
    if (progress) return abort.current?.abort();
    if (readyFile) return void shareReady(readyFile);
    void exportGif();
  };

  if (!catches.length) {
    return (
      <section data-testid="galerie-empty" className="flex min-h-[52dvh] flex-col items-center justify-center gap-1.5 bg-surface px-8 py-10 text-center md:min-h-0 md:rounded-card md:py-16 md:shadow-e0">
        <PhotoIcon aria-hidden className="mb-2 size-12 text-hairline" />
        <h2 className="t-heading text-ink-2">Nicio captură cu poză încă</h2>
        <p className="max-w-[44ch] t-body-strong text-muted">Pozele capturilor din această partidă apar aici.</p>
      </section>
    );
  }

  const canExport = catches.length >= 2;
  const busy = progress !== null;
  const gifButton = (floating: boolean) => (
    <button
      type="button"
      onClick={onGif}
      aria-busy={busy || undefined}
      aria-label={busy ? `Anulează GIF-ul: ${progress.done} din ${progress.total} gata` : undefined}
      title={busy ? 'Anulează' : undefined}
      data-testid="galerie-gif"
      data-state={busy ? 'busy' : readyFile ? 'ready' : 'idle'}
      className={cn(
        'flex cursor-pointer items-center justify-center gap-1.5 rounded-full bg-indigo-5 t-body-strong text-surface transition-[opacity,filter] duration-(--duration-fast) ease-fast hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-85',
        floating ? 'h-12 px-5 shadow-e2' : 'h-10 px-4.5',
      )}
    >
      {busy ? <T2Spinner className="size-4.5" /> : readyFile ? <ShareIcon aria-hidden className="size-4.5 stroke-[2.4]" /> : <FilmIcon aria-hidden className="size-4.5 stroke-[2.4]" />}
      <span className="tabular-nums">{busy ? `${progress.done}/${progress.total}` : readyFile ? 'Distribuie GIF-ul' : 'Exportă GIF'}</span>
    </button>
  );

  return (
    <div data-testid="galerie" data-count={catches.length} className="flex flex-col md:gap-4">
      <section aria-labelledby="galerie-title" className="flex flex-col gap-3 bg-surface px-3 pt-3 pb-4 md:rounded-card md:p-4 md:shadow-e0">
        <div className="flex min-h-10 items-center justify-between gap-3 px-1 md:px-0">
          <h2 id="galerie-title" className="t-body-strong text-muted">
            {formatCount(catches.length, 'captură cu poză', 'capturi cu poză')}
          </h2>
          {canExport ? <div className="max-md:hidden">{gifButton(false)}</div> : null}
        </div>
        {ratios.settled ? (
          <MasonryGrid
            items={shown}
            ratioOf={e => (broken.has(e.clientId) ? DEFAULT_RATIO : tileRatio(ratios.ratioOf(gridPhoto(e))))}
            keyOf={e => e.clientId}
            label="Pozele capturilor"
            testId="galerie-grid"
            skeletonLabel="Se încarcă pozele…"
          >
            {e => (
              <CatchTile
                c={{ src: gridPhoto(e), ratio: ratios.ratioOf(gridPhoto(e)), weightKg: e.weightKg, species: e.species, anglerName: null }}
                variant="caption"
                kind="capture"
                broken={broken.has(e.clientId)}
                onBroken={() => setBroken(prev => (prev.has(e.clientId) ? prev : new Set(prev).add(e.clientId)))}
                onOpen={() => setOpenId(e.clientId)}
                label={`Deschide poza${galleryCaption(e) ? `: ${galleryCaption(e)}` : ''}`}
              />
            )}
          </MasonryGrid>
        ) : (
          <MasonrySkeleton label="Se încarcă pozele…" count={catches.length} />
        )}
      </section>

      {/* phone: fish's floating pill, bottom right — sticky to the screen's bottom edge while the grid is in view */}
      {canExport ? <div className="sticky bottom-[max(--spacing(4),env(safe-area-inset-bottom))] z-sticky flex justify-end px-4 pt-4 pb-2 md:hidden">{gifButton(true)}</div> : null}
      <p role="status" className="sr-only">
        {progress ? `Se generează GIF-ul: ${progress.done} din ${progress.total}` : readyFile ? 'GIF-ul e gata. Apasă «Distribuie GIF-ul».' : ''}
      </p>

      <Lightbox
        items={items}
        index={found >= 0 ? found : null}
        onIndex={i => setOpenId(i == null ? null : (catches[i]?.clientId ?? null))}
        total={catches.length}
        label="Galerie"
        title={(n, of) => `Captura ${n} din ${of}`}
        headerStart={(_, i) => (
          <button
            type="button"
            aria-label="Distribuie captura"
            className={ROUND}
            onClick={() => {
              const e = catches[i];
              if (!e) return;
              // fish: the lightbox closes first, then the share card opens over the page.
              setOpenId(null);
              setSharing(e);
            }}
          >
            <ShareIcon aria-hidden className="size-6" />
          </button>
        )}
        footer={(_, i) => (catches[i] ? <GalerieLightboxFooter e={catches[i]} /> : null)}
      />
      <ShareCatchSheet target={target} lakeName={name} onClose={() => setSharing(null)} />
    </div>
  );
}

/** fish CatchLightboxFooter: the big kg (its unit apart, rule 10), then «specie · ora». */
function GalerieLightboxFooter({ e }: { e: LocalEvent }) {
  const secondary = [e.species, fmtClock(e.occurredAt)].filter(Boolean).join(' · ');
  return (
    <div className="flex flex-col gap-0.75" data-testid="galerie-lightbox-footer">
      {e.weightKg != null ? (
        <p className="flex items-baseline gap-1.25">
          <span className="t-display">{fmtKg(e.weightKg)}</span>
          <span className="t-heading text-lavender-3">kg</span>
        </p>
      ) : null}
      {secondary ? <p className="t-body text-lavender-2">{secondary}</p> : null}
    </div>
  );
}
