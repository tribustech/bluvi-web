import Link from 'next/link';
import { ChevronRightIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import { venueHref as fishVenueHref, type CommunitySessionDetailDTO } from '@/core/partide';
import { routes } from '@/lib/routes';
import { pastCardMeta } from './format';
import { SafeImg } from './SafeImg';

/*
 * The venue at the bottom of the partidă — fish comunitate/[id].tsx lake card (parity
 * partide.spectator.c13): the venue image (or the pin on the indigo tint), the name, «localitate ·
 * 30 IUL · 6h» (fish fmtPastCardMeta without the catch count), a chevron — a link to the venue page
 * when there is one (a lake, a public water with its code), plain otherwise (a pin).
 */

type VenueFields = Pick<CommunitySessionDetailDTO, 'lakeId' | 'venueType' | 'publicWaterCode'>;

/** fish community/view.ts venueHref, on the web's routes: the lake page, the public water's, or null. */
export function venueWebHref(d: VenueFields): string | null {
  if (!fishVenueHref(d)) return null;
  if (d.lakeId) return routes.lake(d.lakeId);
  return d.publicWaterCode ? routes.publicWater(d.publicWaterCode) : null;
}

/** The venue's own image (never a catch photo); older CMS deploys: `imageUrl` (fish). */
export const venueImageOf = (d: Pick<CommunitySessionDetailDTO, 'venueImageUrl' | 'imageUrl'>) => d.venueImageUrl ?? d.imageUrl ?? null;

export function VenueCard({
  detail,
  className,
}: {
  detail: Pick<CommunitySessionDetailDTO, 'venueName' | 'locality' | 'startedAt' | 'endedAt' | 'durationMs' | 'venueImageUrl' | 'imageUrl'> & VenueFields;
  className?: string;
}) {
  const href = venueWebHref(detail);
  const image = venueImageOf(detail);
  const meta = [detail.locality, pastCardMeta(detail)].filter(Boolean).join(' · ');
  const pin = (
    <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-card bg-accent-tint text-accent">
      <MapPinIcon className="size-6" />
    </span>
  );
  const body = (
    <>
      {image ? <SafeImg src={image} className="size-14 shrink-0 rounded-card bg-soft-fill object-cover" fallback={pin} /> : pin}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate t-heading text-ink">{detail.venueName}</span>
        <span className="truncate t-caption text-muted">{meta}</span>
      </span>
      {href ? <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-muted" /> : null}
    </>
  );
  const box = cn('flex items-center gap-3 bg-surface p-3 md:rounded-card md:shadow-e0', className);
  return href ? (
    <Link
      href={href}
      data-testid="partida-venue"
      className={cn(box, 'transition-colors duration-(--duration-fast) ease-fast hover:bg-page focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent')}
    >
      {body}
    </Link>
  ) : (
    <div data-testid="partida-venue" className={box}>
      {body}
    </div>
  );
}
