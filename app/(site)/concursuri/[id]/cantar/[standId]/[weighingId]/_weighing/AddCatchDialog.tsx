'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowPathIcon, CameraIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { fishTypesQuery } from '@/core/competitions';
import {
  addCatchToWeighingMutation,
  uploadMediaToCatchMutation,
  weighingKeys,
} from '@/core/organizer';
import type { Transport } from '@/core/transport';
import { ModalSurface } from '@/components/surfaces/ModalSurface';
import { BigNumberInput, ChoiceChips, QuantityStepper } from '@/components/templates/T6';
import { Button } from '@/components/ui/Button';
import { compressImage } from '@/lib/client/compress-image';
import { useSiteToast } from '@/app/(site)/_shell/Toast';
import {
  LAST_SPECIES_KEY,
  MAX_MEDIA,
  MAX_QUANTITY,
  catchData,
  catchMediaFilename,
  hasErrors,
  kg,
  sanitizeWeight,
  splitDrift,
  splitPreview,
  validateCatch,
} from './model';

/*
 * «Adaugă captură» (fish components/AddCatchSheet.tsx; parity c7–c13). A bottom sheet on the phone,
 * a dialog from 768 (ModalSurface), titled «Adaugă captură» with an «Închide» X.
 *  - c8 weight in kg (comma or dot): required, > 0, ≤ 60 — fish's messages;
 *  - c9 quantity 1–20 («buc», default 1); above 1 the «Pești» row previews the split in 0.025 kg steps;
 *  - c10 species chips (the competition's fish types), required; the last used one is restored on
 *    open when the competition still has it (localStorage, every access in try/catch);
 *  - c11 «Adaugă media»: a photo from the camera or the files (no `capture`: the phone offers both),
 *    up to 3 («Fișiere media (max. 3)»), each removable, the button off at 3;
 *  - c12 «Finalizează» adds and closes on success; «Adaugă și continuă» adds and resets weight,
 *    quantity and photos, keeping the species; while it runs: «Se adaugă captura...»;
 *  - c13 the rows show at once (core onMutate, optimistic), rolled back on failure (error toast); the
 *    photos go to the first created catch; toasts as fish.
 * One submit = one chain: compress the photos → POST the catch → POST the photos → toast. A local
 * `submitting` flag covers the WHOLE chain (the spinner, the footer, a second submit, and — through
 * `onSubmittingChange` — «Finalizează cântarul», c14): the mutations' own flags both read false while
 * the photos compress (1–3 s on a phone), which once showed the filled form again with an enabled
 * «Finalizează» and let a second tap POST the same catch twice.
 * Every write is the CMS's: POST /weighings/:id/catch, then POST /upload (ref api::catch.catch).
 */

type Photo = { file: File; url: string };

function readLastSpecies(): string {
  try {
    return window.localStorage.getItem(LAST_SPECIES_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeLastSpecies(id: string) {
  try {
    window.localStorage.setItem(LAST_SPECIES_KEY, id);
  } catch {
    /* private mode: the species is simply not remembered */
  }
}

export function AddCatchDialog({
  open,
  onClose,
  t,
  competitionId,
  weighingId,
  onSubmittingChange,
}: {
  open: boolean;
  onClose: () => void;
  t: Transport;
  competitionId: string;
  weighingId: string;
  /** true from a valid submit until its last write settles (the screen blocks the close meanwhile). */
  onSubmittingChange?: (submitting: boolean) => void;
}) {
  const qc = useQueryClient();
  const toast = useSiteToast();
  const species = useQuery({ ...fishTypesQuery(t, competitionId), enabled: open && !!competitionId });
  const add = useMutation(addCatchToWeighingMutation(t, qc, weighingId));
  const upload = useMutation(uploadMediaToCatchMutation(t));
  const [submitting, setSubmittingState] = useState(false);
  const submittingRef = useRef(false);
  const setSubmitting = (v: boolean) => {
    submittingRef.current = v;
    setSubmittingState(v);
    onSubmittingChange?.(v);
  };
  const pending = submitting;

  const [weight, setWeight] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [speciesId, setSpeciesId] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  const focusWeight = useRef(false);

  const options = useMemo(() => (species.data ?? []).map((s) => ({ value: s.documentId, label: s.Name })), [species.data]);

  // fish restoreLastFishSpecies: on open, and when the list lands while open.
  const [restoredFor, setRestoredFor] = useState<string | null>(null);
  const restoreKey = open && options.length ? options.map((o) => o.value).join('|') : null;
  if (restoreKey && restoredFor !== restoreKey) {
    setRestoredFor(restoreKey);
    const stored = readLastSpecies();
    if (stored && options.some((o) => o.value === stored)) setSpeciesId(stored);
  }
  if (!open && restoredFor !== null) setRestoredFor(null);

  const errors = submitted ? validateCatch(weight, quantity, speciesId) : {};
  const split = errors.quantity ? [] : splitPreview(weight, quantity);
  const drift = split.length > 1 ? splitDrift(weight, quantity) : null;

  // On open the weight takes focus (fish opens the sheet on the field). The parent's effect runs after
  // ModalSurface's showModal(), which would otherwise focus the first control (the X).
  useEffect(() => {
    if (open) weightRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (pending || !focusWeight.current) return;
    focusWeight.current = false;
    weightRef.current?.focus();
  }, [pending]);

  const clearPhotos = () => {
    setPhotos((p) => {
      for (const ph of p) URL.revokeObjectURL(ph.url);
      return [];
    });
  };

  const reset = (keepSpecies: boolean) => {
    setWeight('');
    setQuantity(1);
    clearPhotos();
    setSubmitted(false);
    if (!keepSpecies) setSpeciesId('');
  };

  // Closing while a catch is being added is allowed (fish's sheet can be swiped away): the write
  // goes on, its rows stay optimistic in the list and «Finalizează cântarul» waits for it (c14).
  const close = () => {
    // fish onDismiss={reset}: a dismissed sheet starts clean (the species comes back from storage).
    reset(false);
    onClose();
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setSubmitted(true);
    const invalid = validateCatch(weight, quantity, speciesId);
    if (hasErrors(invalid)) {
      const first = invalid.weight ? 'weight' : invalid.quantity ? 'quantity' : 'species';
      const target = formRef.current?.querySelector<HTMLInputElement>(
        first === 'species' ? 'input[name="species"]' : `input[name="${first}"]`,
      );
      if (target && first === 'species') target.dataset.focusRing = '';
      target?.focus();
      return;
    }
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const finish = submitter?.value !== 'continue';
    const files = photos.map((p) => p.file);
    const name = options.find((o) => o.value === speciesId)?.label;
    const data = catchData(weight, quantity, speciesId);
    writeLastSpecies(speciesId);
    setSubmitting(true);

    // fish handleAddAndContinue: the form resets at once, the species stays.
    if (!finish) {
      focusWeight.current = true;
      reset(true);
    }

    void (async () => {
      // 1. The photos first: nothing is written while they compress. A photo that cannot be read
      //    does not cost the catch (fish adds it and toasts the media failure).
      let blobs: File[] | null = null;
      if (files.length > 0) {
        try {
          blobs = await Promise.all(files.map((f) => compressImage(f)));
        } catch {
          blobs = null;
        }
      }
      // 2. The catch.
      let created: Awaited<ReturnType<typeof add.mutateAsync>>;
      try {
        created = await add.mutateAsync({ weighingId, fishTypeName: name, data });
      } catch (error) {
        void qc.invalidateQueries({ queryKey: weighingKeys.byId(weighingId) });
        void qc.invalidateQueries({ queryKey: weighingKeys.byCompetitionId(competitionId) });
        toast((error as Error).message || 'Captura nu a fost adăugată.', 'danger');
        setSubmitting(false);
        return;
      }
      // fish: refresh the stand's history (its totals).
      void qc.invalidateQueries({ queryKey: weighingKeys.byCompetitionId(competitionId) });
      // 3. Its photos, on the first created catch.
      let ok = true;
      if (files.length > 0 && created[0]) {
        try {
          if (!blobs) throw new Error('compression failed');
          const id = created[0].id;
          const list = blobs;
          await upload.mutateAsync({ id, files: list.map((blob, i) => ({ blob, filename: catchMediaFilename(id, files[i].name) })) });
        } catch {
          ok = false;
        }
      }
      void qc.invalidateQueries({ queryKey: weighingKeys.byId(weighingId) });
      setSubmitting(false);
      if (finish) close();
      toast(ok ? 'Captură adăugată cu succes!' : 'Captură adăugată, dar nu s-a putut adăuga media', ok ? 'success' : 'danger');
    })();
  };

  const addPhotos = (list: FileList | null) => {
    if (!list) return;
    const room = MAX_MEDIA - photos.length;
    const next = Array.from(list)
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, Math.max(0, room))
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPhotos((p) => [...p, ...next]);
  };

  const removePhoto = (url: string) => {
    URL.revokeObjectURL(url);
    setPhotos((p) => p.filter((ph) => ph.url !== url));
  };

  return (
    <ModalSurface
      open={open}
      onClose={close}
      title="Adaugă captură"
      bodyClassName="py-4"
      footer={
        pending ? null : (
          <div className="flex flex-col gap-2.5 md:flex-row-reverse">
            <Button type="submit" form="adauga-captura" name="intent" value="finish" block className="md:flex-1">
              Finalizează
            </Button>
            <Button type="submit" form="adauga-captura" name="intent" value="continue" variant="outline" block className="md:flex-1">
              Adaugă și continuă
            </Button>
          </div>
        )
      }
    >
      {!open ? null : pending ? (
        <div role="status" className="flex h-full min-h-60 flex-col items-center justify-center gap-4" data-testid="add-catch-pending">
          <ArrowPathIcon aria-hidden className="size-10 text-accent motion-safe:animate-spin" />
          <p className="t-body-strong text-muted">Se adaugă captura...</p>
        </div>
      ) : (
        <form ref={formRef} id="adauga-captura" noValidate onSubmit={submit} className="flex flex-col gap-5">
          <BigNumberInput
            ref={weightRef}
            label="Greutate"
            unit="kg"
            name="weight"
            value={weight}
            onChange={(v) => setWeight(sanitizeWeight(v))}
            error={errors.weight}
            helper="Cu virgulă sau punct: 4,250"
          />
          <QuantityStepper
            label="Cantitate"
            unit="buc"
            name="quantity"
            value={quantity}
            onChange={setQuantity}
            min={1}
            max={MAX_QUANTITY}
            error={errors.quantity}
          />
          {split.length > 1 ? (
            <div className="flex flex-col gap-2" data-testid="add-catch-split">
              <p id="add-catch-split" className="t-label text-ink-2">
                Pești
              </p>
              <ul aria-labelledby="add-catch-split" className="flex flex-wrap gap-2">
                {split.map((w, i) => (
                  <li key={i} className="t-caption rounded-control bg-soft-fill px-2 py-1 text-ink-2 tabular-nums">
                    {kg(w)}&nbsp;kg
                  </li>
                ))}
              </ul>
              {drift !== null ? (
                <p className="t-caption text-muted" data-testid="add-catch-split-drift">
                  Pe pești, în pași de 0,025&nbsp;kg: total {kg(drift)}&nbsp;kg.
                </p>
              ) : null}
            </div>
          ) : null}
          {species.isPending ? (
            <p role="status" className="t-caption text-muted">
              Se încarcă speciile…
            </p>
          ) : species.isError ? (
            <div role="alert" className="flex flex-wrap items-center gap-3">
              <p className="t-caption text-status-danger-fg">Nu am putut încărca speciile.</p>
              <Button size="compact" variant="secondary" onClick={() => void species.refetch()}>
                Încearcă din nou
              </Button>
            </div>
          ) : options.length === 0 ? (
            <p className="t-caption text-muted">Concursul nu are specii configurate.</p>
          ) : (
            <ChoiceChips label="Specia" name="species" options={options} value={speciesId} onChange={setSpeciesId} error={errors.species} />
          )}

          <div className="flex flex-col gap-3">
            {photos.length > 0 ? (
              <>
                <p className="t-label text-ink-2">
                  Fișiere media <span className="text-muted">(max. {MAX_MEDIA})</span>
                </p>
                <ul className="flex flex-wrap gap-4" data-testid="add-catch-photos">
                  {photos.map((p, i) => (
                    <li key={p.url} className="relative">
                      {/* A local object URL preview: no optimizer. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={`Fotografia ${i + 1}`} className="size-24 rounded-control object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(p.url)}
                        aria-label={`Elimină fotografia ${i + 1}`}
                        className="absolute -top-3 -right-3 flex size-8 items-center justify-center rounded-full bg-live text-on-accent shadow-e1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        <XMarkIcon aria-hidden className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              data-testid="add-catch-file"
              onChange={(e) => {
                addPhotos(e.target.files);
                e.target.value = '';
              }}
            />
            <Button
              variant="secondary"
              icon={<CameraIcon />}
              onClick={() => fileRef.current?.click()}
              disabled={photos.length >= MAX_MEDIA}
              block
            >
              Adaugă media
            </Button>
          </div>
        </form>
      )}
    </ModalSurface>
  );
}
