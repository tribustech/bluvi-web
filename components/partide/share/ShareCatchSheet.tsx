'use client';

import { CheckIcon, PencilSquareIcon, ShareIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';
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

/**
 * A Jurnal row that is not a capture (fish ShareCatchSheet's second shape, `OutcomeRecord`): a
 * «Scăpat» or a «Fără trăsătură» is a note to yourself — no image, nothing to publish, just where
 * the rod was, what was on the hook and when. Delete is its only action.
 */
export type ShareCatchRecord = {
  outcome: 'lost' | 'blank';
  rodIndex: number | null;
  rodColor: string | null;
  /** fish eventMeta: «Centru · 50 m · Boilies», '' for none. */
  meta: string;
  /** «14:05». */
  time: string;
};

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
  record = null,
  onEdit,
  onDelete,
  onClose,
}: {
  target: ShareCatchTarget | null;
  /** fish `lakeName`: the venue drawn on the card (and the «Baltă» switch); '' for none. */
  lakeName: string;
  /** fish `competitionName`: set for a competition catch — the «Competiție» switch and line. */
  competitionName?: string | null;
  /** Set for a scăpat / fără trăsătură (the Jurnal): the record shape instead of the card. */
  record?: ShareCatchRecord | null;
  /** fish `onEdit` (a capture of a live partidă): «Editează captura» beside «Distribuie». */
  onEdit?: () => void;
  /** fish `onDelete` (a live partidă): «Șterge captura» / «Șterge»; the caller owns the confirmation. */
  onDelete?: () => void;
  onClose: () => void;
}) {
  const phone = useBreakpoint() === 'mobile';
  const open = target != null;
  // The last catch stays drawn while the surface animates out.
  const [shown, setShown] = useState<{
    target: ShareCatchTarget;
    lakeName: string;
    competitionName: string | null;
    record: ShareCatchRecord | null;
    onEdit?: () => void;
    onDelete?: () => void;
  } | null>(target ? { target, lakeName, competitionName, record, onEdit, onDelete } : null);
  if (target && (target !== shown?.target || record !== shown.record || onEdit !== shown.onEdit || onDelete !== shown.onDelete)) {
    setShown({ target, lakeName, competitionName, record, onEdit, onDelete });
  }
  const iconActions = shown ? <IconActions onEdit={shown.onEdit} onDelete={shown.onDelete} /> : null;
  const body = !shown ? null : shown.record ? (
    <RecordBody record={shown.record} waterName={shown.lakeName} onDelete={shown.onDelete} />
  ) : (
    <ShareBody key={shown.target.key} c={shown.target} waterName={shown.lakeName} competitionName={shown.competitionName} actions={iconActions} />
  );
  const title = !shown?.record ? 'Distribuie captura' : shown.record.outcome === 'lost' ? 'Scăpat' : 'Fără trăsătură';
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

/** fish IconAction: the secondary actions reduced to their glyph, level with «Distribuie». */
function IconActions({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
  if (!onEdit && !onDelete) return null;
  const base =
    'flex h-12 w-13 shrink-0 cursor-pointer items-center justify-center rounded-control transition-[filter] duration-(--duration-fast) ease-fast hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent xl:h-10';
  return (
    <>
      {onEdit ? (
        <button type="button" aria-label="Editează captura" title="Editează captura" onClick={onEdit} className={cn(base, 'bg-soft-fill text-accent-ink')}>
          <PencilSquareIcon aria-hidden className="size-5" />
        </button>
      ) : null}
      {onDelete ? (
        <button type="button" aria-label="Șterge captura" title="Șterge captura" onClick={onDelete} className={cn(base, 'bg-status-danger-bg text-status-danger-fg')}>
          <TrashIcon aria-hidden className="size-5" />
        </button>
      ) : null}
    </>
  );
}

/** fish OutcomeRecord: a plain block (the rod-card button that wrote it collected nothing). */
function RecordBody({ record, waterName, onDelete }: { record: ShareCatchRecord; waterName: string; onDelete?: () => void }) {
  const lost = record.outcome === 'lost';
  return (
    <div className="flex flex-col gap-4 pt-2" data-testid="share-catch-record">
      <div
        className={cn(
          'flex flex-col gap-2.5 rounded-card border-l-3 px-3.5 py-3.5',
          lost ? 'border-yellow-5 bg-status-warning-bg/50' : 'border-muted bg-page',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {record.rodIndex !== null ? (
              <span className="inline-flex items-center gap-1.25 rounded-full bg-soft-fill px-2 py-1 t-micro-strong text-ink-2">
                <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: record.rodColor ?? 'var(--color-indigo-5)' }} />L{record.rodIndex}
              </span>
            ) : null}
            <span className="t-body-strong text-ink">{lost ? 'Scăpat' : 'Fără trăsătură'}</span>
          </div>
          <span className="t-label text-muted tabular-nums">{record.time}</span>
        </div>
        {record.meta ? <p className="t-caption text-muted">{record.meta}</p> : null}
        {waterName ? <p className="t-caption text-muted">{waterName}</p> : null}
      </div>
      {onDelete ? (
        <Button variant="danger" block onClick={onDelete} icon={<TrashIcon aria-hidden />}>
          Șterge
        </Button>
      ) : null}
    </div>
  );
}

function ShareBody({ c, waterName, competitionName, actions }: { c: ShareCatchTarget; waterName: string; competitionName: string | null; actions?: ReactNode }) {
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
      <div className="flex items-stretch gap-2.5">
        <Button variant="success" className="min-w-0 flex-1 shrink!" onClick={() => void share()} disabled={sharing || !assets} icon={<ShareIcon aria-hidden />}>
          {sharing || !assets ? 'Se pregătește…' : 'Distribuie'}
        </Button>
        {actions}
      </div>
    </div>
  );
}
