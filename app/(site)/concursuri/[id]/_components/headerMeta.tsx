import Link from 'next/link';
import { MapPinIcon } from '@heroicons/react/20/solid';
import type { CompetitionDetail } from '@/core/competitions';
import { PRESENCE_ICON } from '@/components/templates/T3';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';

/*
 * The header's server-known parts — thumbnail, organiser, lake, dates — written once for the loaded
 * header (CompetitionHeader) and for the page's fallback while the screen streams in
 * (CompetitionSkeleton `head`): the static shell paints the real title and meta line, and the
 * loaded header lands on the same text in the same place.
 */

export type HeaderCore = Pick<CompetitionDetail, 'name' | 'author' | 'lake' | 'banner' | 'competitionStatus'>;

/** The banner at thumbnail size, or the placeholder at the thumbnail's own size (192px, 2× the 96px box). */
export function competitionThumb(c: Pick<HeaderCore, 'banner'>): string {
  return c.banner?.formats.small?.url ?? c.banner?.formats.medium?.url ?? c.banner?.url ?? '/images/competition-placeholder-thumb.jpg';
}

/**
 * The thumbnail. Lazy: below 768 the media is display:none (DetailHeader), and an eager <img> is
 * preloaded by React in the document head — the phone downloaded a picture it never shows, ahead of
 * its first paint. From 768 it is in the first viewport, so lazy still loads it at once. A remote
 * CMS banner at thumbnail size: the image optimizer buys nothing here. 768–1279 it is 64px, so the
 * title keeps its measure beside it and the labelled actions.
 */
export function CompetitionThumb({ competition }: { competition: Pick<HeaderCore, 'banner'> }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={competitionThumb(competition)}
      alt=""
      className="size-16 rounded-card bg-soft-fill object-cover xl:size-24"
      loading="lazy"
      decoding="async"
    />
  );
}

/** DetailHeader's meta list: organiser, lake, dates (before the start the phone keeps the dates in the preview). */
export function competitionMeta(c: HeaderCore, datesProse: string) {
  return [
    <span key="author">Organizat de {c.author?.username || 'Necunoscut'}</span>,
    <LakeLink key="lake" competition={c} />,
    datesProse ? (
      <span key="dates" className={cn(c.competitionStatus === 'notStarted' && 'max-md:hidden')}>
        {datesProse}
      </span>
    ) : null,
  ];
}

function LakeLink({ competition }: { competition: Pick<HeaderCore, 'lake'> }) {
  const pin = <MapPinIcon aria-hidden className={cn(PRESENCE_ICON.meta, 'shrink-0 text-accent')} />;
  const cls = 'inline-flex min-w-0 items-center gap-1';
  if (!competition.lake?.documentId) {
    return (
      <span className={cls}>
        {pin}
        {competition.lake?.name || 'Nedefinit'}
      </span>
    );
  }
  return (
    <Link href={routes.lake(competition.lake.documentId)} className={cn(cls, 'text-accent-ink hover:underline')}>
      {pin}
      {competition.lake.name}
    </Link>
  );
}
