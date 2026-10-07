'use client';

import type { ReactNode } from 'react';
import { CameraIcon, ChevronRightIcon, ClockIcon, MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { FishingRodIcon } from '@/components/icons/brand';
import { cn } from '@/components/ui/cn';
import { WormIcon } from './icons';

/*
 * «DETALII» (parity partide.captura.c5; fish captura.tsx DETALII card): Lansetă, Poziția pe hartă,
 * Momeală, Poză, Ora — one white card of rows, each a full-width button (leading icon in a 38px
 * slot, the label, a subtitle or a right-aligned value, a chevron). «Poză» with a photo shows its
 * thumbnail with a remove ✕ (a sibling button, never nested).
 */

export type DetailsModel = {
  rodLabel: string;
  placeLabel: string;
  placeIsPrompt: boolean;
  hasPlace: boolean;
  baitLabel: string;
  photoUrl: string | null;
  photoPreparing: boolean;
  timeLabel: string;
};

export function DetailsRows({
  model,
  onRod,
  onPlace,
  onBait,
  onPhoto,
  onRemovePhoto,
  onTime,
}: {
  model: DetailsModel;
  onRod: () => void;
  onPlace: () => void;
  onBait: () => void;
  onPhoto: () => void;
  onRemovePhoto: () => void;
  onTime: () => void;
}) {
  return (
    <ul data-testid="capture-details" className="flex flex-col overflow-hidden rounded-card bg-surface shadow-e1">
      <Row testId="detail-rod" onClick={onRod} leading={<FishingRodIcon size={22} className="text-accent" />} label="Lansetă" value={model.rodLabel} valueTone="ink" />
      <Row
        testId="detail-place"
        onClick={onPlace}
        leading={
          model.hasPlace ? (
            <span className="flex size-9.5 items-center justify-center rounded-control bg-accent-tint">
              <span className="size-3 rounded-full border-2 border-surface bg-accent shadow-e1" />
            </span>
          ) : (
            <MapPinIcon className="size-5 text-accent" />
          )
        }
        label="Poziția pe hartă"
        subtitle={model.placeLabel}
        subtitleTone={model.placeIsPrompt ? 'accent' : 'muted'}
      />
      <Row testId="detail-bait" onClick={onBait} leading={<WormIcon className="size-5 text-accent" />} label="Momeală" value={model.baitLabel || 'Adaugă'} valueTone={model.baitLabel ? "ink" : "muted"} />
      <li className="relative border-t border-hairline">
        <RowButton
          testId="detail-photo"
          onClick={onPhoto}
          leading={<CameraIcon className="size-5 text-accent" />}
          label="Poză"
          value={model.photoPreparing ? 'Se pregătește…' : model.photoUrl ? undefined : 'Adaugă'}
          valueTone="muted"
          trailingSpace={!!model.photoUrl}
        />
        {model.photoUrl ? (
          <span className="pointer-events-none absolute top-1/2 right-11 -translate-y-1/2">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL / the catch photo, not an optimisable asset */}
            <img src={model.photoUrl} alt="Poza capturii" data-testid="detail-photo-thumb" className="size-9.5 rounded-control object-cover" />
            <button
              type="button"
              aria-label="Șterge poza"
              data-testid="detail-photo-remove"
              onClick={onRemovePhoto}
              className="pointer-events-auto absolute -top-2 -right-2 flex size-6 cursor-pointer items-center justify-center rounded-full bg-status-danger-fg text-on-accent shadow-e1"
            >
              <XMarkIcon aria-hidden className="size-3.5 stroke-[2.6]" />
            </button>
          </span>
        ) : null}
      </li>
      <Row testId="detail-time" onClick={onTime} leading={<ClockIcon className="size-5 text-accent" />} label="Ora" value={model.timeLabel} valueTone="ink" />
    </ul>
  );
}

type Tone = 'ink' | 'faint' | 'muted' | 'accent';
const TONE: Record<Tone, string> = { ink: 'text-ink', faint: 'text-faint', muted: 'text-muted', accent: 'text-accent-ink' };

function Row(props: Parameters<typeof RowButton>[0]) {
  return (
    <li className="border-t border-hairline first:border-t-0">
      <RowButton {...props} />
    </li>
  );
}

function RowButton({
  testId,
  onClick,
  leading,
  label,
  subtitle,
  subtitleTone = 'muted',
  value,
  valueTone = 'muted',
  trailingSpace = false,
}: {
  testId: string;
  onClick: () => void;
  leading: ReactNode;
  label: string;
  subtitle?: string;
  subtitleTone?: Tone;
  value?: string;
  valueTone?: Tone;
  /** Room for an overlaid trailing element (the photo thumb). */
  trailingSpace?: boolean;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className="flex min-h-16 w-full cursor-pointer items-center gap-3 px-3.5 py-3 text-left transition-colors duration-(--duration-fast) hover:bg-soft-fill"
    >
      <span aria-hidden className="flex w-9.5 shrink-0 justify-center">
        {leading}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="t-body-strong text-ink">{label}</span>
        {subtitle ? <span className={cn('truncate t-caption font-bold', TONE[subtitleTone])}>{subtitle}</span> : null}
      </span>
      {value ? <span className={cn('max-w-[55%] truncate text-right t-caption font-bold', TONE[valueTone])}>{value}</span> : null}
      {trailingSpace ? <span aria-hidden className="w-11 shrink-0" /> : null}
      <ChevronRightIcon aria-hidden className="size-4.5 shrink-0 stroke-[2.4] text-faint" />
    </button>
  );
}
