'use client';

import Link from 'next/link';
import { TrophyIcon } from '@heroicons/react/24/outline';
import { BentoArt, bentoSurface } from '@/components/ui/BentoTile';
import { cn } from '@/components/ui/cn';
import { firstNameOf, fmtKg, recordTagFor, type StatsPeriod, type StatsRecord } from '@/core/partide';
import { partidaHref } from '@/lib/routes';
import { usePhotoFailed } from '../../../ape-publice/_components/venue/bits';
import { dayMonth } from '../../../ape-publice/_components/venue/dates';

/*
 * The period's record — fish RecordHero (parity partide.statistici.c7), as the bento's navy
 * signature tile (owner rule 19): the catch's photo under a scrim, or — no photo, or it failed —
 * the navy surface with the trophy as its corner art. A photo that fails to load switches the whole
 * tile to that fallback (art, badge, text tones and sizing), not just drops the picture. The period tag («RECORDUL LUNII»), the
 * weight as the signature number with its own spaced unit (rule 10), the species, and «Prenume ·
 * baltă · 12 IUL». It opens the record's partidă when the record carries one (else not a link).
 */

export function RecordHero({ period, record, className }: { period: StatsPeriod; record: StatsRecord; className?: string }) {
  const meta = [record.angler?.name ? firstNameOf(record.angler.name) : null, record.venueName, dayMonth(record.occurredAt)].filter(Boolean).join(' · ');
  const [failed, check, onError] = usePhotoFailed(record.photoUrl);
  const photo = record.photoUrl && !failed ? record.photoUrl : null;
  const tag = recordTagFor(period);
  const kg = fmtKg(record.weightKg);
  const href = record.sessionDocumentId ? partidaHref(record.sessionDocumentId) : null;
  const body = (
    <>
      {photo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- CMS rendition, already sized. */}
          <img ref={check} src={photo} alt="" loading="eager" onError={onError} className="absolute inset-0 z-behind size-full object-cover" data-testid="record-photo" />
          <span aria-hidden className="absolute inset-0 z-behind bg-linear-to-t from-photo-scrim via-photo-scrim/40 to-transparent" />
        </>
      ) : (
        <BentoArt>
          <TrophyIcon data-testid="record-trophy" />
        </BentoArt>
      )}
      <span className={cn('self-start rounded-badge px-2 py-1 t-micro-strong tracking-wide', photo ? 'bg-photo-scrim text-on-photo-scrim' : 'bg-lavender/15 text-lavender')} data-testid="record-tag" data-tone={photo ? 'scrim' : 'navy'}>
        {tag}
      </span>
      <span className={cn('flex min-w-0 flex-col gap-1', photo ? 'text-on-photo-scrim' : 'text-lavender-2')}>
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="whitespace-nowrap">
            <span className={cn('t-num-40 tabular-nums', !photo && 'text-lavender')} data-testid="record-kg">
              {kg}
            </span>
            <span className="ms-0.5 t-unit-18">{' '}kg</span>
          </span>
          {record.species ? <span className="t-heading" data-testid="record-species">{record.species}</span> : null}
        </span>
        {meta ? (
          <span className={cn('truncate t-caption', photo ? 'text-on-photo-scrim' : 'text-lavender-3')} data-testid="record-meta">
            {meta}
          </span>
        ) : null}
      </span>
    </>
  );
  const ground = cn(
    bentoSurface('signature'),
    'flex w-full flex-col justify-between gap-6 rounded-bento p-4.5',
    photo ? 'aspect-video md:aspect-auto md:h-full md:min-h-64' : 'min-h-39 md:h-full',
  );
  const label = `${tag.toLowerCase()}: ${kg} kg${record.species ? `, ${record.species}` : ''}`;
  return (
    <figure aria-label={label} className={cn('flex', className)} data-testid="record-hero">
      {href ? (
        <Link
          href={href}
          className={cn(ground, 'transition-[filter] hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent')}
          data-testid="record-link"
        >
          {body}
        </Link>
      ) : (
        <div className={ground}>{body}</div>
      )}
    </figure>
  );
}
