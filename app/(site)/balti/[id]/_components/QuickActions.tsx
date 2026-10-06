'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  CalendarDaysIcon,
  ChartBarIcon,
  MapIcon,
  PaperAirplaneIcon,
  StarIcon,
  TagIcon,
  TrophyIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { H3_CLASS } from '@/components/templates/T3';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { lakeHref } from './availability';
import { BookingTile, DialogTrigger } from './LakeActions';
import { onSectionJump } from './SectionLink';

/*
 * «Acțiuni rapide» — fish quickActions + VenueQuickActions (lakes.detail.c14, c15) in the T3 tile
 * look (DetailQuickActions: 64px indigo squares, label under it). Composed here because two of
 * fish's tiles are buttons, not links (Rezervă may open a dialog, Direcții the maps dialog).
 * TODO(kit): DetailQuickActions with button tiles (`render`), then this file goes.
 *
 * Like the kit, a tile only exists for what the web can do: an action whose page is not on the web
 * yet (availability.ts) is named once in the muted «Curând pe web: …» line, never a dead tile. The
 * Rezervă tile is always there (useBookingTarget decides on click), so the row never changes with
 * the session. No «NOU» on Rezervă: fish dated it to before 2026-10-01 (c15). The count badges
 * (Partide active now, Concursuri live) belong to tiles whose pages are not on the web yet.
 *
 * Rhythm: phone — always four 64px tracks spread over the row, filled from the left edge, so two
 * or three tiles keep fish's spacing instead of huddling or stretching; from 768 the kit's tracks —
 * 64px tiles 24px apart from the left. The page hides the whole block from 1280, where the section
 * index, the booking card and the Contact section carry the same actions.
 */

type Tile = {
  key: string;
  label: string;
  icon: ReactNode;
  /** A link (route or `#section`), the booking affordance, or the directions dialog. */
  kind: 'link' | 'booking' | 'directions';
  href?: string;
  badge?: number;
  /** Not on the web yet: named in the «Curând pe web» line. */
  later?: boolean;
};

const TILE =
  'group flex w-full cursor-pointer flex-col items-center gap-2 rounded-control text-center transition-opacity duration-(--duration-fast) ease-fast active:opacity-70';

export function QuickActions({
  lakeId,
  hasPrices,
  hasCoordinates,
  className,
}: {
  lakeId: string;
  hasPrices: boolean;
  hasCoordinates: boolean;
  className?: string;
}) {
  const routeTile = (key: string, label: string, icon: ReactNode, href: string | undefined): Tile => ({
    key,
    label,
    icon,
    kind: 'link',
    href,
    later: !href,
  });
  const tiles: Tile[] = [
    { key: 'rezerva', label: 'Rezervă', icon: <CalendarDaysIcon />, kind: 'booking' },
    ...(hasPrices ? [routeTile('preturi', 'Prețuri', <TagIcon />, '#preturi')] : []),
    routeTile('partide', 'Partide', <UsersIcon />, lakeHref('partide', routes.lakePartide(lakeId))),
    routeTile('statistici', 'Statistici', <ChartBarIcon />, lakeHref('stats', routes.lakeStats(lakeId))),
    routeTile('concursuri', 'Concursuri', <TrophyIcon />, lakeHref('competitions', routes.lakeCompetitions(lakeId))),
    ...(hasCoordinates
      ? [
          { key: 'directii', label: 'Direcții', icon: <PaperAirplaneIcon />, kind: 'directions' as const },
          routeTile('harta', 'Hartă', <MapIcon />, lakeHref('map', routes.lakeMap(lakeId))),
        ]
      : []),
    routeTile('recenzii', 'Recenzii', <StarIcon />, '#recenzii'),
  ];
  const shown = tiles.filter(t => !t.later);
  const later = tiles.filter(t => t.later);

  return (
    <div className={cn('flex flex-col gap-3.5', className)}>
      <h3 className={H3_CLASS}>Acțiuni rapide</h3>
      <ul
        aria-label="Acțiuni rapide"
        className="grid grid-cols-[repeat(4,--spacing(16))] justify-between gap-y-4 md:grid-cols-[repeat(auto-fill,--spacing(16))] md:justify-start md:gap-x-6"
      >
        {shown.map(t => {
          const body = (
            <>
              <span className="relative flex size-16 items-center justify-center rounded-card bg-accent-tint-2 text-accent-ink transition-[filter] duration-(--duration-fast) ease-fast group-hover:brightness-95 [&>svg]:size-6">
                {t.icon}
                {t.badge ? (
                  <span className="absolute -top-1.25 -right-1.25 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-surface bg-status-live-bg px-1.25 t-micro-strong text-status-live-fg">
                    {t.badge}
                  </span>
                ) : null}
              </span>
              <span className="t-label whitespace-nowrap">{t.label}</span>
            </>
          );
          return (
            <li key={t.key} className="flex justify-center" data-tile={t.key}>
              {t.kind === 'booking' ? (
                <BookingTile className={TILE}>{body}</BookingTile>
              ) : t.kind === 'directions' ? (
                <DialogTrigger dialog="directions" className={TILE}>
                  {body}
                </DialogTrigger>
              ) : t.href?.startsWith('#') ? (
                <a href={t.href} onClick={e => onSectionJump(e, t.href!.slice(1))} className={TILE}>
                  {body}
                </a>
              ) : (
                <Link href={t.href as string} className={TILE}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      {later.length ? (
        <p className="t-caption text-muted" data-testid="quick-actions-later">
          Curând pe web: {later.map(t => t.label).join(', ')}.
        </p>
      ) : null}
    </div>
  );
}
