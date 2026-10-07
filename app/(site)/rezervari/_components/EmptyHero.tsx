import Link from 'next/link';
import { BellAlertIcon, CalendarDaysIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { PARAM } from '../../balti/_list/url';
import { routes } from '@/lib/routes';

/**
 * c9 — Bălți with «Acceptă rezervări online» pre-applied (fish goToLakes sets bookableOnly): the
 * hero's whole pitch is booking, so unbookable lakes there would dead-end it.
 */
export const BOOKABLE_LAKES_HREF = `${routes.lakes()}?${PARAM.bookable}=1`;

const FEATURES = [
  { Icon: MapPinIcon, title: 'Alegi standul', body: 'Vezi ce e liber pe zile și ore, direct în pagina bălții.' },
  { Icon: BellAlertIcon, title: 'Primești confirmarea', body: 'Administratorul acceptă cererea, tu primești notificare.' },
  { Icon: CalendarDaysIcon, title: 'Le ții pe toate aici', body: 'Data, standul și totalul de plată, într-un singur loc.' },
] as const;

/*
 * Rule 4 (do not promise what is not there): fish's hero also promises the booking code and cancelling
 * «din aplicație»; on the web both live on the booking page (/rezervari/[id], booking.rezervare, B2),
 * which is not on the web yet (ON_WEB.bookingDetail). Put fish's copy back when that page ships.
 */

/**
 * c8 — fish features/bookings/ui/BookingsEmptyState.tsx: an account with no bookings at all («Toate»,
 * no sub). The hero sells the page (the indigo gradient card with the water lines and one white
 * pill, «Caută o baltă») and the three rows say what it does: pick, get confirmed, keep them here.
 * From 1024 the two sit side by side (an empty desktop is not a phone column stretched); from 1280 the
 * rows sit in the docked right column instead (HeroFeatures «aside»).
 */
export function EmptyHero() {
  return (
    <div data-testid="bookings-empty-hero" className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:grid-cols-1">
      <section
        aria-labelledby="bookings-empty-title"
        className="relative isolate flex flex-col items-start overflow-hidden rounded-bento bg-linear-to-br from-bento-indigo to-bento-indigo-2 px-5 pt-6 pb-5 text-on-bento-indigo shadow-e2 md:px-7 md:pt-8 md:pb-7"
      >
        {/* Decorative water, bottom right (fish's three wave lines). */}
        <svg
          aria-hidden
          viewBox="0 0 200 160"
          className="pointer-events-none absolute -right-6 -bottom-8 z-behind h-38 w-48 opacity-30 md:h-48 md:w-60"
        >
          {[40, 80, 120].map((y) => (
            <path key={y} d={`M10 ${y} q25 -18 50 0 t50 0 t50 0`} stroke="currentColor" strokeWidth={7} strokeLinecap="round" fill="none" />
          ))}
        </svg>
        <h2 id="bookings-empty-title" className="t-title1">
          Rezervările tale, într-un loc
        </h2>
        <p className="mt-1.5 mb-5 max-w-sm t-body text-on-bento-indigo-2 md:mb-7">
          Rezervi standul din pagina bălții și le găsești pe toate aici: dată, oră, stand și total.
        </p>
        <Link
          href={BOOKABLE_LAKES_HREF}
          className={cn(
            'inline-flex h-12 items-center rounded-full bg-surface px-5 t-body-strong text-accent-ink shadow-e2 xl:h-11',
            'transition-[filter,opacity] duration-(--duration-fast) ease-fast hover:brightness-95 active:opacity-85',
            'outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-on-bento-indigo',
          )}
        >
          Caută o baltă
        </Link>
      </section>
      <HeroFeatures variant="inline" />
    </div>
  );
}

/**
 * The hero's three rows. Beside the hero card up to 1279 («inline»); from 1280 they move to the docked
 * right column («aside»), so that column is never empty on the hero and the tracks never change.
 */
export function HeroFeatures({ variant }: { variant: 'inline' | 'aside' }) {
  return (
    <ul
      data-testid={variant === 'aside' ? 'bookings-hero-features-aside' : 'bookings-hero-features'}
      className={cn(
        'flex flex-col justify-center gap-4 bg-surface',
        variant === 'inline' ? 'rounded-bento p-4 shadow-e1 md:p-6 xl:hidden' : 'rounded-card p-4 shadow-e0',
      )}
    >
      {FEATURES.map(({ Icon, title, body }) => (
        <li key={title} className="flex items-start gap-3">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-control bg-accent-tint text-accent-ink">
            <Icon className="size-4.5" strokeWidth={1.9} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="t-body-strong text-ink">{title}</span>
            <span className="t-caption text-muted">{body}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The docked right column's standing card (≥1280, web only): the way to a bookable lake, with fish's
 * own words for it, so the column is never empty while the list is there. Not shown with the hero,
 * which already carries the same call.
 */
export function FindLakeCard() {
  return (
    <section aria-labelledby="find-lake-title" data-testid="find-lake-card" className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-e0">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-control bg-accent-tint text-accent-ink">
          <MapPinIcon className="size-5" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="find-lake-title" className="t-heading text-ink">
            Alegi standul
          </h2>
          <p className="t-caption text-muted">Vezi ce e liber pe zile și ore, direct în pagina bălții.</p>
        </div>
      </div>
      <ButtonLink href={BOOKABLE_LAKES_HREF} variant="secondary" block>
        Caută o baltă
      </ButtonLink>
    </section>
  );
}
