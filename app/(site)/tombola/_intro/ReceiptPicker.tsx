'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { CameraIcon, PhotoIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { raffleCopy } from '../_shared/copy';
import { useCoarsePointer } from '../_shared/media';

const C = raffleCopy.intro;

/**
 * fish raffle/index.tsx:309-355 «Adaugă bon fiscal PescarMania» (participant.raffle-intro.c9): the
 * receipt is only chosen here — it is uploaded after the join succeeds (c14). fish offers
 * «Fotografiază» (camera) and «Din galerie»; the web has one picker accepting images, plus the
 * camera variant (capture=environment) on a touch screen. Chosen → the preview and «Elimină imaginea».
 */
export function ReceiptPicker({ file, onChange, disabled }: { file: File | null; onChange: (f: File | null) => void; disabled?: boolean }) {
  const touch = useCoarsePointer();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<{ file: File; url: string } | null>(null);
  const preview = chosen && chosen.file === file ? chosen.url : null;
  // The blob: URL lives as long as its choice: revoked when replaced, removed or unmounted.
  useEffect(() => (chosen ? () => URL.revokeObjectURL(chosen.url) : undefined), [chosen]);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setChosen({ file: f, url: URL.createObjectURL(f) });
    onChange(f);
  };

  return (
    <section aria-labelledby="tombola-bon-titlu" className="rounded-card border-l-4 border-accent bg-accent-tint p-4 md:p-5">
      <h2 id="tombola-bon-titlu" className="t-body-strong text-accent-ink">
        {C.addReceiptBeforeJoin}
      </h2>
      <p className="t-body mt-2 text-ink-2">{C.addReceiptBeforeJoinHint}</p>
      {file && preview ? (
        <div className="mt-3 flex flex-col items-center gap-2.5">
          <span className="relative block h-45 w-full max-w-70 overflow-hidden rounded-control bg-surface">
            <Image src={preview} alt={C.receiptPreviewAlt} fill unoptimized sizes="280px" className="object-contain" data-testid="receipt-preview" />
          </span>
          <Button variant="outline" icon={<TrashIcon />} onClick={() => {
              setChosen(null);
              onChange(null);
            }} disabled={disabled}>
            {C.removeReceipt}
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2.5">
          {touch ? (
            <Button icon={<CameraIcon />} onClick={() => camera.current?.click()} disabled={disabled}>
              {C.takePhoto}
            </Button>
          ) : null}
          <Button variant={touch ? 'outline' : 'primary'} icon={<PhotoIcon />} onClick={() => gallery.current?.click()} disabled={disabled}>
            {C.pickFromGallery}
          </Button>
        </div>
      )}
      <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden data-testid="receipt-camera" onChange={pick} />
      <input ref={gallery} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden data-testid="receipt-gallery" onChange={pick} />
    </section>
  );
}
