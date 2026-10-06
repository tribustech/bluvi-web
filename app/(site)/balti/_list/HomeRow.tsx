'use client';

import { ArrowRightIcon, ChevronRightIcon, ClockIcon, HomeIcon, StarIcon, TicketIcon, TrophyIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useEffect, useRef, useState, type ComponentType, type MouseEvent, type SVGProps } from 'react';
import { DashboardSection, LINK_ACTION } from '@/components/templates/T5';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { getLakesHomeCardPresentation, type LakeHomeSection } from '@/core/lakes';
import {
  CardSkeleton,
  HorizontalRail,
  RailArrows,
  RailEndCard,
  RailItem,
  RailRegistry,
  type RailHandle,
} from '@/app/(site)/_home/HorizontalRail';
import { track } from './analytics';
import { distanceLabel } from './distance';
import { FishOutlineIcon } from '@/components/nav/brand';
import { CompassIcon, NavigationIcon, TelescopeIcon, WavesIcon } from './icons';
import { LakeTile, TILE_HEIGHT } from './LakeTile';

/*
 * One Bălți home row — fish features/lakes/components/LakesHomeSectionRow.tsx: an icon badge in the
 * section's colour and the title (lakes.home.c9), at most 10 lakes in a horizontal rail, «Vezi toate ›»
 * in the header and a «Vezi toate» card at the end when there are more (c10), the radius «50 km ›»
 * instead on the nearby row (c12). The rail is Acasă's (HorizontalRail: snap, the screen-edge bleed,
 * auto-fill tracks from 768, the mouse arrows in the header). The rails are the PHONE's home (fish);
 * from 768 the CMS rows are one grid with icon categories (owner rule 5 — HomeGrid), and only the
 * nearby rail stays, when it fills a row.
 *
 * Analytics (c28, fish LakesHomeSectionRow): one lake_home_section_impression when a row with
 * content mounts, and lake_home_section_click on every card opened.
 */

/** fish handleSectionImpression: once per mount of a section with content. */
function useSectionImpression(sectionKey: string, position: number, lakesCount: number, shown?: { current: HTMLElement | null }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    // A row mounted but not rendered at this width (the phone rails under the desktop grid) is not seen.
    if (shown && !shown.current?.getClientRects().length) return;
    done.current = true;
    track('lake_home_section_impression', { section_key: sectionKey, section_position: position, lakes_count: lakesCount });
  }, [sectionKey, position, lakesCount, shown]);
}

/** fish SECTION_VISIBLE_LAKES_COUNT. */
export const SECTION_VISIBLE_LAKES = 10;

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * fish getSectionIconConfig: an outer tint and an inner solid circle per section. fish's raw
 * colours become the nearest token pairs (tint ring, solid core, glyph). The status cores flip with
 * the theme (dark fg in light, light fg in dark), so their glyph is `text-surface`, which flips the
 * other way: white on the dark core in light, the dark surface on the light core in dark — every
 * glyph keeps ≥4.5:1 on its core in both themes.
 */
const SECTION_BADGE: Record<string, { Icon: Icon; ring: string; core: string }> = {
  recent_viewed: { Icon: ClockIcon, ring: 'bg-status-neutral-bg', core: 'bg-ink-2 text-surface' },
  nearby: { Icon: CompassIcon, ring: 'bg-accent-tint-2', core: 'bg-accent text-on-accent' },
  all_lakes: { Icon: WavesIcon, ring: 'bg-accent-tint-2', core: 'bg-accent-ink text-on-accent' },
  bookable: { Icon: TicketIcon, ring: 'bg-accent-tint', core: 'bg-accent text-on-accent' },
  top_rated: { Icon: StarIcon, ring: 'bg-status-warning-bg', core: 'bg-status-warning-fg text-surface' },
  with_retention: { Icon: FishOutlineIcon, ring: 'bg-status-success-bg', core: 'bg-status-success-fg text-surface' },
  with_cabins: { Icon: HomeIcon, ring: 'bg-badge-green-bg', core: 'bg-badge-green-fg text-surface' },
  competition_lakes: { Icon: TrophyIcon, ring: 'bg-status-danger-bg', core: 'bg-status-danger-fg text-surface' },
};
const OTHER_BADGE = { Icon: TelescopeIcon, ring: 'bg-status-pending-bg', core: 'bg-status-pending-fg text-surface' };

export function SectionBadge({ sectionKey }: { sectionKey: string }) {
  const { Icon, ring, core } = SECTION_BADGE[sectionKey] ?? OTHER_BADGE;
  return (
    <span aria-hidden className={cn('flex size-11 shrink-0 items-center justify-center rounded-full', ring)}>
      <span className={cn('flex size-7.5 items-center justify-center rounded-full [&>svg]:size-4 [&>svg]:stroke-2', core)}>
        <Icon />
      </span>
    </span>
  );
}

/** The header's trailing link: «Vezi toate ›» or the nearby radius «50 km ›». */
function HeaderLink({ href, label, srLabel }: { href: string; label: string; srLabel: string }) {
  return (
    <Link href={href} aria-label={srLabel} className={cn(LINK_ACTION, '-my-3 gap-0.5')}>
      {label}
      <ChevronRightIcon aria-hidden className="size-3.5 stroke-[2.5]" />
    </Link>
  );
}

/**
 * fish's «Vezi toate» card at the end of a long row. From 768 it is Acasă's rail end card; fish
 * shows it at every width, and the kit card is 768+ only, so a phone gets the same card here.
 * TODO(kit): a `phone` prop on RailEndCard (app/(site)/_home/HorizontalRail.tsx), then drop the copy.
 */
function SeeAllEnd({ href, title, heightClass }: { href: string; title: string; heightClass: string }) {
  return (
    <>
      <RailEndCard href={href} label="Vezi toate" caption={title} icon={<ArrowRightIcon />} heightClass={heightClass} />
      <li className="flex w-40 shrink-0 snap-start md:hidden">
        <Link
          href={href}
          className={cn(
            'group flex w-full flex-col items-center justify-center gap-3 rounded-card border border-dashed border-hairline p-4 text-center',
            'transition-colors duration-(--duration-fast) ease-fast hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent',
            heightClass,
          )}
        >
          <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-accent-tint text-accent-ink [&>svg]:size-6">
            <ArrowRightIcon />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="t-body-strong text-accent-ink">Vezi toate</span>
            <span className="t-caption text-muted">{title}</span>
          </span>
        </Link>
      </li>
    </>
  );
}

export function HomeRow({
  section,
  position,
  seeAllHref,
  radiusAction,
}: {
  section: LakeHomeSection;
  /** 1-based place among the page's sections (analytics). */
  position: number;
  /** Where «Vezi toate» goes (lakes.home.c11). */
  seeAllHref: string;
  /** The nearby row: «50 km ›» and where it goes (c12). */
  radiusAction?: { label: string; href: string } | null;
}) {
  const [rail, setRail] = useState<RailHandle | null>(null);
  const presentation = getLakesHomeCardPresentation(section.key);
  const compact = !presentation.showFacilities;
  const variant = compact ? 'compact' : 'default';
  const width = compact ? 160 : 200;
  const canSeeAll = section.lakes.length > SECTION_VISIBLE_LAKES;
  const lakes = canSeeAll ? section.lakes.slice(0, SECTION_VISIBLE_LAKES) : section.lakes;
  const shownRef = useRef<HTMLDivElement>(null);
  useSectionImpression(section.key, position, section.lakes.length, shownRef);

  const link = radiusAction ? (
    <HeaderLink href={radiusAction.href} label={radiusAction.label} srLabel={`Vezi pe hartă bălțile pe o rază de ${radiusAction.label}`} />
  ) : canSeeAll ? (
    <HeaderLink href={seeAllHref} label="Vezi toate" srLabel={`Vezi toate: ${section.title}`} />
  ) : null;

  /** fish handleLakePress: a card's link opened (pointer or keyboard). */
  const onCardClick = (e: MouseEvent<HTMLElement>) => {
    const a = (e.target as Element).closest('a[href]');
    const item = a?.closest<HTMLElement>('[data-lake-id]');
    if (!a || !item) return;
    track('lake_home_section_click', {
      section_key: section.key,
      section_position: position,
      item_position: Number(item.dataset.itemPosition),
      lake_id: item.dataset.lakeId,
    });
  };
  const distanceOf = (lake: (typeof lakes)[number]) =>
    section.key === 'nearby' ? distanceLabel((lake as { distanceKm?: number }).distanceKm ?? Number.NaN) : null;

  const railRow = (
    <HorizontalRail label={section.title} width={width}>
      {lakes.map((lake, i) => (
        <RailItem key={lake.documentId} width={width}>
          <div data-lake-id={lake.documentId} data-item-position={i + 1}>
            <LakeTile lake={lake} variant={variant} distanceLabel={distanceOf(lake)} />
          </div>
        </RailItem>
      ))}
      {canSeeAll ? <SeeAllEnd href={seeAllHref} title={section.title} heightClass={TILE_HEIGHT[variant]} /> : null}
    </HorizontalRail>
  );

  return (
    <RailRegistry.Provider value={setRail}>
      <DashboardSection
        variant="plain"
        title={
          <span className="flex items-center gap-2">
            <SectionBadge sectionKey={section.key} />
            {section.title}
          </span>
        }
        action={
          // Centred on the 44px badge row (the badge sets the heading row's height).
          <span className="mt-2.75 flex items-center gap-3">
            <RailArrows rail={rail} />
            {link}
          </span>
        }
      >
        <div ref={shownRef} onClick={onCardClick}>
          {railRow}
        </div>
      </DashboardSection>
    </RailRegistry.Provider>
  );
}

/**
 * fish LakesNearbyPermissionPlaceholder (lakes.home.c17): the nearby slot while location is not
 * granted — one card that starts the location flow. Full column width; from 768 one row: the
 * icon, the title over its line, the action on the right (a kit primary button's look — the whole
 * card is the one button).
 */
const PLACEHOLDER_COPY = {
  never_asked: {
    title: 'Descoperă bălți aproape de tine',
    description: 'Permite locația și îți arătăm instant locurile din apropiere.',
    cta: 'Permite locația',
  },
  denied: {
    title: 'Activează locația din setări',
    description: 'Permisiunea e blocată acum, dar o poți reactiva rapid.',
    cta: 'Deschide setările',
  },
  services_off: {
    title: 'Activează locația dispozitivului',
    description: 'Permisiunea e dată, dar locația telefonului este oprită.',
    cta: 'Deschide setările',
  },
} as const;

/** The placeholder card's box — its skeleton takes the same (HomeSkeleton). */
const NEARBY_CARD_BOX = 'min-h-44 md:min-h-24';

export function NearbyPlaceholder({
  mode,
  position,
  onActivate,
  busy = false,
}: {
  mode: keyof typeof PLACEHOLDER_COPY;
  /** 1-based place among the page's sections (analytics: fish counts it as a section). */
  position: number;
  onActivate: () => void;
  busy?: boolean;
}) {
  const copy = PLACEHOLDER_COPY[mode];
  useSectionImpression('nearby', position, 0);
  return (
    <section aria-labelledby="balti-nearby-title">
      <button
        type="button"
        onClick={onActivate}
        aria-busy={busy || undefined}
        aria-describedby="balti-nearby-desc"
        className={cn(
          'group flex w-full cursor-pointer flex-col items-start gap-3 rounded-card border border-accent-tint-3 bg-status-info-bg p-4 text-left md:flex-row md:items-center md:gap-4 md:px-5',
          'transition-[filter] duration-(--duration-fast) ease-fast hover:brightness-[0.98] active:opacity-80',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          NEARBY_CARD_BOX,
        )}
      >
        <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-tint-2 text-accent-ink">
          <NavigationIcon className="size-6" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span id="balti-nearby-title" className="t-heading text-accent-ink">
            {copy.title}
          </span>
          <span id="balti-nearby-desc" className="max-w-[60ch] t-body text-status-info-fg">
            {copy.description}
          </span>
        </span>
        <span className={buttonClass({ variant: 'primary', className: 'shrink-0 max-md:w-full' })}>{busy ? 'Se caută locația…' : copy.cta}</span>
      </button>
    </section>
  );
}

/** One row's bones: the header (badge, title; from 768 the arrows + link area) over a rail of cards. */
function RowSkeleton({ compact = false }: { compact?: boolean }) {
  const width = compact ? 160 : 200;
  return (
    <DashboardSection
      variant="plain"
      title={
        <span className="flex items-center gap-2">
          <span className="size-11 animate-shimmer rounded-full" />
          <span className="h-4 w-44 animate-shimmer rounded-full" />
        </span>
      }
      action={<span className="mt-2.75 hidden h-6 w-24 animate-shimmer rounded-full md:block" />}
    >
      <HorizontalRail label="Se încarcă" width={width}>
        {Array.from({ length: 8 }, (_, i) => (
          <RailItem key={i} width={width}>
            <CardSkeleton width={width} heightClass={TILE_HEIGHT[compact ? 'compact' : 'default']} />
          </RailItem>
        ))}
      </HorizontalRail>
    </DashboardSection>
  );
}

/**
 * A slot whose row is coming: the nearby row (location granted, the located read in flight) or
 * «Vizualizate recent» (compact cards) while its lakes load.
 */
export function SlotRowSkeleton({ compact = false }: { compact?: boolean }) {
  // Silent: LakesHome's one status line says what is loading (a status that mounts populated, or
  // with only a name, is never spoken).
  return (
    <div aria-hidden>
      <RowSkeleton compact={compact} />
    </div>
  );
}

/**
 * The nearby slot while the permission is being read: the placeholder card's box, or — when this
 * browser had location granted last time (./geoHint.ts, set before paint) — a row's, so the rows
 * below do not move when the answer comes.
 */
export function NearbySlotSkeleton() {
  return (
    <>
      <div aria-hidden className={cn('animate-shimmer rounded-card [:root:has(#balti-geo-granted)_&]:hidden', NEARBY_CARD_BOX)} />
      <div aria-hidden className="hidden [:root:has(#balti-geo-granted)_&]:block">
        <RowSkeleton />
      </div>
    </>
  );
}

/**
 * fish LakesListSkeleton variant «home», in the final shape: the nearby slot first (the
 * placeholder card's box, or a row when location is granted), then rows of a header over a rail —
 * the real rail (HorizontalRail tracks in the same @container) and the real gaps, so nothing moves
 * when the rows arrive.
 */
export function HomeSkeleton({ rows = 3, nearbySlot = 'placeholder' }: { rows?: number; nearbySlot?: 'placeholder' | 'row' | null }) {
  return (
    <div aria-hidden className="@container flex flex-col gap-7 xl:gap-9">
      {nearbySlot === 'placeholder' ? <NearbySlotSkeleton /> : null}
      <div className="contents">
        {nearbySlot === 'row' ? <RowSkeleton /> : null}
        {Array.from({ length: rows }, (_, r) => (
          <RowSkeleton key={r} />
        ))}
      </div>
    </div>
  );
}
