'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { PhotoCropDialog, type CropTarget } from '@/app/(site)/concursuri/[id]/chat/_chat/composer/PhotoCropDialog';
import type { ChatPhotoEdit } from '@/app/(site)/concursuri/[id]/chat/_chat/composer/cropResult';
import { Button } from '@/components/ui/Button';

/*
 * organizer.step-basics c3 — «Banner» (fish step-basics.tsx:309-341: ImagePicker with
 * allowsEditing + quality 0.75, then a 4:3 thumbnail). On the web: the file picker, then the shared
 * photo crop (components/photo-crop, the chat's dialog: 4:3 by default, rotate / flip) whose
 * canvas pipeline encodes a JPEG under the upload cap; the result goes to the wizard
 * (pickBanner → an object URL in values.banner + a debounced auto-save). The upload itself is the
 * wizard's, on the next save / publish (context.tsx).
 */

let pickSeq = 0;

export function BannerPicker({ banner, disabled, onPick }: { banner: string | undefined; disabled: boolean; onPick: (blob: Blob, filename: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<CropTarget | null>(null);
  const labelId = useId();
  const helpId = useId();

  const onFile = (file: File | undefined) => {
    if (!file) return;
    pickSeq += 1;
    setTarget({ id: `banner-${pickSeq}`, file });
  };

  const cancel = useCallback(() => setTarget(null), []);
  const save = useCallback(
    (edit: ChatPhotoEdit) => {
      setTarget(null);
      onPick(edit.blob, `competition_banner_${Date.now()}.jpg`);
    },
    [onPick],
  );

  return (
    <div role="group" aria-labelledby={labelId} aria-describedby={helpId} className="flex flex-col gap-1.5" data-testid="banner-picker">
      <p id={labelId} className="t-label text-ink-2">
        Banner
      </p>
      <p id={helpId} className="t-caption text-muted">
        Imaginea principală afișată pe pagina competiției.
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-3">
        <span
          className="flex aspect-4/3 w-28 shrink-0 items-center justify-center overflow-hidden rounded-control bg-soft-fill text-muted md:w-32"
          data-testid="banner-thumbnail"
          data-empty={banner ? undefined : 'true'}
        >
          {banner ? (
            // A local pick is an object URL, a saved banner the CMS's: a plain <img> serves both.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={banner} alt="Bannerul ales" className="size-full object-cover" />
          ) : (
            <PhotoIcon aria-hidden className="size-7" />
          )}
        </span>
        <div className="flex min-w-0 flex-col items-start gap-1">
          <Button variant="secondary" disabled={disabled} onClick={() => inputRef.current?.click()} data-testid="banner-choose">
            Alege o fotografie
          </Button>
          {!banner ? <span className="t-caption text-muted">Nicio fotografie aleasă</span> : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        tabIndex={-1}
        aria-hidden
        data-testid="banner-input"
        onChange={(e) => {
          onFile(e.currentTarget.files?.[0]);
          // The same file picked again still opens the crop.
          e.currentTarget.value = '';
        }}
      />
      <PhotoCropDialog target={target} onCancel={cancel} onSave={save} />
    </div>
  );
}
