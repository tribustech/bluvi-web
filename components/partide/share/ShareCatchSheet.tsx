'use client';

import { CheckIcon, ShareIcon } from '@heroicons/react/24/outline';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSiteToast } from '@/app/(site)/_shell/Toast';
import { LogoHorizontal } from '@/components/nav/brand';
import { Dialog } from '@/components/surfaces/Dialog';
import { Sheet } from '@/components/surfaces/Sheet';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import {
  ALL_FIELDS,
  CARD_H,
  CARD_W,
  cardFile,
  drawShareCard,
  loadImage,
  SHARE_FIELD_LABEL,
  shareablePhotoSrc,
  shareCardLines,
  shareFieldKeys,
  type ShareField,
  type ShareFields,
} from './shareCard';

/**
 * The catch a share card is drawn for — the narrow slice every caller adapts its own DTO to (fish
 * anglerCatchToShareEvent / lakeCatchToShareEvent): a public water's catch, my catch (Ale mele,
 * Capturile mele), a Jurnal row, a Galerie photo, an angler profile's catch.
 */
export type ShareCatchTarget = {
  /** Stable per catch: the body (switches, the drawn card) is reset when it changes. */
  key: string;
  /** The full photo (fish eventPhotoUri: the original first); null → the brand composition. */
  photoUrl: string | null;
  weightKg: number | null;
  species: string | null;
  occurredAt: string;
};

/** The wordmark as an image for the canvas: the inline logo serialised white. */
function logoImage(svg: SVGSVGElement | null): Promise<HTMLImageElement | null> {
  if (!svg) return Promise.resolve(null);
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.setAttribute('color', 'white');
  const [, , w, h] = (copy.getAttribute('viewBox') ?? '0 0 1833 624').split(/\s+/).map(Number);
  copy.setAttribute('width', String(Math.round(w)));
  copy.setAttribute('height', String(Math.round(h)));
  copy.removeAttribute('class');
  copy.removeAttribute('aria-hidden');
  return loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`);
}

type Assets = { photo: HTMLImageElement | null; logo: HTMLImageElement | null; family: string };

/**
 * «Distribuie captura» — fish features/partide/components/ShareCatchSheet.tsx (the capture shape),
 * the one share surface of every screen that shares a catch: the exact image that will be shared,
 * «Ce să apară pe poză» switches for what the catch has (Greutate, Baltă, Specie, Data, Competiție
 * — none when fewer than two), and «Distribuie» («Se pregătește…» while the PNG is made), which
 * hands the PNG to the system share sheet (no message: the card says it all). Where the browser
 * cannot share files (most desktops) the PNG is saved instead, and the toast says so. A bottom
 * sheet on the phone, a dialog from 768 (Fundații §07).
 *
 * fish useShareCatchHandoff: a caller opening it from a lightbox closes the lightbox first, then
 * sets `target` — the web's native <dialog>s need no delay between the two.
 */
export function ShareCatchSheet({
  target,
  lakeName,
  competitionName = null,
  onClose,
}: {
  target: ShareCatchTarget | null;
  /** fish `lakeName`: the venue drawn on the card (and the «Baltă» switch); '' for none. */
  lakeName: string;
  /** fish `competitionName`: set for a competition catch — the «Competiție» switch and line. */
  competitionName?: string | null;
  onClose: () => void;
}) {
  const phone = useBreakpoint() === 'mobile';
  const open = target != null;
  // The last catch stays drawn while the surface animates out.
  const [shown, setShown] = useState<{ target: ShareCatchTarget; lakeName: string; competitionName: string | null } | null>(
    target ? { target, lakeName, competitionName } : null,
  );
  if (target && target !== shown?.target) setShown({ target, lakeName, competitionName });
  const body = shown ? <ShareBody key={shown.target.key} c={shown.target} waterName={shown.lakeName} competitionName={shown.competitionName} /> : null;
  const title = 'Distribuie captura';
  return phone ? (
    <Sheet open={open} onClose={onClose} title={title} initialSnap={0.9}>
      {body}
    </Sheet>
  ) : (
    <Dialog open={open} onClose={onClose} title={title} closeButton className="max-h-[90dvh] [&>div:first-child]:overflow-y-auto">
      {body}
    </Dialog>
  );
}

function ShareBody({ c, waterName, competitionName }: { c: ShareCatchTarget; waterName: string; competitionName: string | null }) {
  const toast = useSiteToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<SVGSVGElement>(null);
  const [fields, setFields] = useState<ShareFields>(ALL_FIELDS);
  const [assets, setAssets] = useState<Assets | null>(null);
  const [sharing, setSharing] = useState(false);
  const keys = useMemo(() => shareFieldKeys(c, waterName, competitionName), [c, waterName, competitionName]);
  const label = `Imaginea care se distribuie: ${shareCardLines(c, waterName, fields, competitionName).join(' · ') || 'captură'}`;

  // The photo (same-origin, so the canvas can be exported), the wordmark and the page's font.
  useEffect(() => {
    let live = true;
    const src = c.photoUrl;
    const family = getComputedStyle(document.body).fontFamily || 'sans-serif';
    void Promise.all([
      src ? loadImage(shareablePhotoSrc(src, window.location.origin)) : Promise.resolve(null),
      logoImage(logoRef.current),
      document.fonts?.load(`800 40px ${family}`).catch(() => undefined),
    ]).then(([photo, logo]) => {
      if (live) setAssets({ photo, logo, family });
    });
    return () => {
      live = false;
    };
  }, [c]);

  useEffect(() => {
    if (assets && canvasRef.current) drawShareCard(canvasRef.current, { c, waterName, competitionName, fields, ...assets });
  }, [assets, c, waterName, competitionName, fields]);

  const share = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !assets) return;
    setSharing(true);
    try {
      const file = await cardFile(canvas);
      if (!file) {
        toast('Nu am putut pregăti imaginea.', 'danger');
        return;
      }
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Distribuie captura' });
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
      toast('Imaginea a fost salvată.', 'success');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pt-2" data-testid="share-catch">
      <LogoHorizontal ref={logoRef} className="hidden" />
      {/* The exact image that gets shared; rounded only on screen (the PNG keeps square corners). */}
      <div className="relative overflow-hidden rounded-card bg-navy" style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }}>
        <canvas ref={canvasRef} role="img" aria-label={label} width={CARD_W} height={CARD_H} className={cn('block size-full', !assets && 'invisible')} />
        {assets ? null : <span aria-hidden className="absolute inset-0 animate-shimmer bg-soft-fill" />}
      </div>
      {keys.length > 1 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 t-caption text-muted">Ce să apară pe poză</legend>
          <div className="flex flex-wrap gap-2">
            {keys.map((k: ShareField) => {
              const on = fields[k];
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFields(prev => ({ ...prev, [k]: !prev[k] }))}
                  className={cn(
                    'flex h-9 cursor-pointer items-center gap-1.25 rounded-full border-[1.5px] px-3 t-label',
                    on ? 'border-accent bg-accent-tint text-accent-ink' : 'border-hairline bg-surface text-ink-2 hover:bg-soft-fill',
                  )}
                >
                  {on ? <CheckIcon aria-hidden className="size-3.5 stroke-3" /> : null}
                  {SHARE_FIELD_LABEL[k]}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}
      <Button variant="success" block onClick={() => void share()} disabled={sharing || !assets} icon={<ShareIcon aria-hidden />}>
        {sharing || !assets ? 'Se pregătește…' : 'Distribuie'}
      </Button>
    </div>
  );
}
