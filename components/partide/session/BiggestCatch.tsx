'use client';

import { useEffect, useRef, useState } from 'react';
import { StarIcon } from '@heroicons/react/24/solid';
import { BentoArt } from '@/components/ui/BentoTile';
import { cn } from '@/components/ui/cn';
import { SignatureNumber } from '@/components/ui/SignatureNumber';
import { fmtKg, gridSource, type CommunitySessionDetailCatchDTO } from '@/core/partide';
import { clockRo } from './format';

/*
 * «Cea mai mare captură» — fish comunitate/[id].tsx max-catch highlight (parity
 * partide.spectator.c10): the partidă's biggest weighed catch (the server's `maxCatch`), the kg as
 * the signature number, «specie · HH:MM». An Apple-style bento tile (owner rule 19): the catch's
 * photo under a scrim when it has one — then the whole tile is a button opening the lightbox on it
 * (`onOpen`) — else the amber tile with the star. A photo that fails to load falls back to amber.
 * Not rendered without a weighed catch.
 */

export function BiggestCatch({ item, onOpen, className }: { item: CommunitySessionDetailCatchDTO; onOpen?: () => void; className?: string }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);
  const src = item.photoUrl && !failed ? gridSource(item) : null;
  const meta = [item.species, clockRo(item.occurredAt)].filter(Boolean).join(' · ');
  const kg = item.weightKg != null ? fmtKg(item.weightKg) : null;
  const content = (
    <>
      <span aria-hidden className={cn('t-label tracking-[0.4px] uppercase', src ? 'text-on-photo-scrim' : 'text-status-warning-fg')}>
        Cea mai mare captură
      </span>
      <span className="mt-auto flex flex-col gap-1">
        <SignatureNumber
          size="stat"
          value={kg ?? '—'}
          unit={kg ? 'kg' : undefined}
          tone={src ? 'onIndigo' : 'ink'}
          unitTone={src ? 'onIndigo' : 'current'}
        />
        <span className={cn('truncate t-label', src ? 'text-on-photo-scrim' : 'text-status-warning-fg')}>{meta}</span>
      </span>
    </>
  );
  const tile = cn(
    'relative isolate flex min-h-36 w-full md:min-h-44 flex-col items-start gap-3 overflow-hidden p-5 text-left md:rounded-bento md:p-6',
    src ? 'bg-navy' : 'bg-linear-160 from-status-warning-bg from-40% to-surface to-160% text-status-warning-fg',
    className,
  );
  const art = src ? (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={img} src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 z-backdrop size-full object-cover" />
      <span aria-hidden className="absolute inset-0 z-behind bg-linear-to-t from-photo-scrim from-10% via-photo-scrim/40 to-photo-scrim/60" />
    </>
  ) : (
    <BentoArt>
      <StarIcon />
    </BentoArt>
  );
  return (
    <section aria-label="Cea mai mare captură" data-testid="partida-biggest" className="flex min-w-0">
      {onOpen && src ? (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={`Cea mai mare captură: ${[item.species, kg ? `${kg} kg` : null, clockRo(item.occurredAt)].filter(Boolean).join(', ')} — vezi fotografia`}
          onClick={onOpen}
          className={cn(tile, 'group cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent')}
        >
          {art}
          {content}
        </button>
      ) : (
        <div className={tile}>
          {art}
          {content}
        </div>
      )}
    </section>
  );
}
