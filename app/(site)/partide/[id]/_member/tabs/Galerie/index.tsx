'use client';

import { FilmIcon, PhotoIcon, ShareIcon } from '@heroicons/react/24/outline';
import { useEffect, useMemo, useState } from 'react';
import { useSiteToast } from '@/app/(site)/_shell/Toast';
// The lake gallery's masonry and catch tile, read-only (their TODO(kit): a Masonry in components/ui).
import { CatchTile } from '@/app/(site)/balti/[id]/_sub/CatchTile';
import { DEFAULT_RATIO, MasonryGrid, tileRatio } from '@/app/(site)/balti/[id]/_sub/Masonry';
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
 *    the kg chip, then the species) and named «{specie} · {kg} kg»;
 *  - c2 no photo → fish's two lines;
 *  - c3 a tile opens the kit Lightbox on it, with fish's CatchLightboxFooter (the big kg, «specie ·
 *    ora»); «Distribuie captura» closes the lightbox and opens the composed share card
 *    (ShareCatchSheet) for that catch;
 *  - c4 from two photos «Exportă GIF» (fish's floating pill on the phone — sticky to the bottom
 *    edge while the grid is in view —, the toolbar's action from 768) draws every photo catch into a
 *    GIF frame client-side (./gifExport), «{done}/{total}» while it works, then the system share
 *    sheet (a phone) or a download (a desktop: «GIF-ul a fost salvat.»); failure → «Eroare la
 *    generarea GIF-ului».
 */

// Ratios measured from the loaded photos, kept across remounts (fish MasonryGallery measuredRatios).
const measured = new Map<string, number>();

function useRatios(urls: string[]): (url: string) => number {
  const [, bump] = useState(0);
  const key = urls.join('\n');
  useEffect(() => {
    let live = true;
    for (const url of key ? key.split('\n') : []) {
      if (measured.has(url)) continue;
      const img = new Image();
      img.onload = () => {
        measured.set(url, img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : DEFAULT_RATIO);
        if (live) bump(n => n + 1);
      };
      img.onerror = () => measured.set(url, DEFAULT_RATIO);
      img.src = url;
    }
    return () => {
      live = false;
    };
  }, [key]);
  return url => measured.get(url) ?? DEFAULT_RATIO;
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
  const ratioOf = useRatios(useMemo(() => catches.map(gridPhoto), [catches]));
  const [openId, setOpenId] = useState<string | null>(null);
  const [sharing, setSharing] = useState<LocalEvent | null>(null);
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const name = venueName(session);

  // The lightbox follows the catch, not the index: a capture arriving live never moves it.
  const found = openId ? catches.findIndex(e => e.clientId === openId) : -1;
  const items = useMemo<LightboxItem[]>(
    () => catches.map(e => ({ key: e.clientId, src: eventPhotoUri(e) as string, preview: gridPhoto(e), alt: galleryCaption(e) ?? 'Captură' })),
    [catches],
  );
  const target = useMemo(() => (sharing ? toTarget(sharing) : null), [sharing]);

  const exportGif = async () => {
    if (progress || catches.length < 2) return;
    const frames = gifItems(session, catches);
    if (frames.length < 2) return;
    setProgress({ done: 0, total: frames.length });
    try {
      const family = getComputedStyle(document.body).fontFamily || 'sans-serif';
      await document.fonts?.load(`800 40px ${family}`).catch(() => undefined);
      const blob = await exportGalleryGif(frames, { family, onProgress: (done, total) => setProgress({ done, total }) });
      const file = new File([blob], gifFileName(Date.now()), { type: 'image/gif' });
      setProgress(null);
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Distribuie GIF-ul' });
        } catch {
          // Dismissed — nothing was shared.
        }
        return;
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast('GIF-ul a fost salvat.', 'success');
    } catch (err) {
      console.error('[partide gif]', err);
      toast('Eroare la generarea GIF-ului', 'danger');
    } finally {
      setProgress(null);
    }
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
      onClick={() => void exportGif()}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      aria-label={busy ? `Se generează GIF-ul: ${progress.done} din ${progress.total}` : undefined}
      data-testid="galerie-gif"
      className={cn(
        'flex cursor-pointer items-center justify-center gap-1.5 rounded-full bg-indigo-5 t-body-strong text-surface transition-[opacity,filter] duration-(--duration-fast) ease-fast hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-85 aria-disabled:cursor-default',
        floating ? 'h-12 px-5 shadow-e2' : 'h-10 px-4.5',
      )}
    >
      {busy ? <T2Spinner className="size-4.5" /> : <FilmIcon aria-hidden className="size-4.5 stroke-[2.4]" />}
      <span className="tabular-nums">{busy ? `${progress.done}/${progress.total}` : 'Exportă GIF'}</span>
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
        <MasonryGrid
          items={catches}
          ratioOf={e => (broken.has(e.clientId) ? DEFAULT_RATIO : tileRatio(ratioOf(gridPhoto(e))))}
          keyOf={e => e.clientId}
          label="Pozele capturilor"
          testId="galerie-grid"
          skeletonLabel="Se încarcă pozele…"
        >
          {e => (
            <CatchTile
              c={{ src: gridPhoto(e), ratio: ratioOf(gridPhoto(e)), weightKg: e.weightKg, species: e.species, anglerName: null }}
              variant="caption"
              kind="capture"
              broken={broken.has(e.clientId)}
              onBroken={() => setBroken(prev => (prev.has(e.clientId) ? prev : new Set(prev).add(e.clientId)))}
              onOpen={() => setOpenId(e.clientId)}
              label={`Deschide poza${galleryCaption(e) ? `: ${galleryCaption(e)}` : ''}`}
            />
          )}
        </MasonryGrid>
      </section>

      {/* phone: fish's floating pill, bottom right — sticky to the screen's bottom edge while the grid is in view */}
      {canExport ? <div className="sticky bottom-[max(--spacing(4),env(safe-area-inset-bottom))] z-sticky flex justify-end px-4 pt-4 pb-2 md:hidden">{gifButton(true)}</div> : null}
      <p role="status" className="sr-only">
        {progress ? `Se generează GIF-ul: ${progress.done} din ${progress.total}` : ''}
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
