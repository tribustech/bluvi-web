'use client';

import { Suspense, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TabFishIcon, TabHomeIcon, TabMapIcon, TabTrophyIcon } from '@/components/icons/fish-tabs';
import { FishLogo } from '@/components/nav/brand';
import { currentKind, navKeyForPath, PATHS } from '@/components/nav/items';
import { AvatarPhoto } from '@/components/ui/AvatarPhoto';
import { cn } from '@/components/ui/cn';
import { getInitials } from '@/components/ui/initials';
import { routes } from '@/lib/routes';
import { useIsNotFound } from './SiteHeader';
import { isUnknownViewer, useShellViewer } from './viewer-context';

/*
 * The phone tab bar — fish app/(app)/(tabs)/_layout.tsx, ROADMAP §4b rule 25: below 768 the site
 * navigates like the app, with the same five tabs (Acasă, Bălți, Competiții, Partide, Profil — Profil
 * only when signed in, fish `href: null` otherwise), the same glyphs (components/icons/fish-tabs.tsx,
 * ported from the packages fish draws them with), active = accent, a 49px row plus the bottom safe
 * area, a white surface with 16px top corners and fish's tabBarStyle shadow.
 *
 * Like fish, it shows on the tab screens only: a screen pushed over the tabs (a competition, a lake,
 * a flow) has none. Which URLs are «tab screens» is TAB_ROOTS. On those, the top bar is not drawn
 * on the phone either (SiteTopBar): the page's own header is the screen header, as in the app.
 *
 * Intentional differences from fish (the web cannot, or should not, match):
 *  - inactive colour: muted (#656F84), not React Navigation's #8E8E8F — 10px labels must clear AA
 *    (4.5:1) on white; #8E8E8F is 3.3:1;
 *  - label font: Nunito (the site's), not the iOS system font; 10px as in fish, weight 600 (t-micro);
 *  - the «NOU» pill on Partide is not ported: fish's own deadline (PARTIDE_NEW_BADGE_UNTIL,
 *    2026-09-18) has passed, so fish no longer shows it either.
 */

/** URLs that are a tab's own screen (fish's tab roots and the sub-tabs inside them). */
const TAB_ROOTS: readonly RegExp[] = [
  /^\/$/,
  // Bălți: the list, the map and the public-waters toggle are one tab in fish (lakes/index.tsx).
  /^\/balti(\/harta)?\/?$/,
  /^\/ape-publice\/?$/,
  // Competiții: Live, Viitoare, Rezultate are the tab's own status tabs (fish (tabs)/competitions).
  /^\/concursuri(\/(live|viitoare|rezultate))?\/?$/,
  // Partide: Comunitate, Explorează, Ale mele are the hub's sub-tabs.
  /^\/partide(\/(exploreaza|ale-mele))?\/?$/,
  /^\/profil\/?$/,
];

export function isTabRoot(pathname: string | undefined): boolean {
  return pathname !== undefined && TAB_ROOTS.some((r) => r.test(pathname));
}

type Tab = { key: string; label: string; href: string; Icon: ComponentType<{ className?: string }> };

const TABS: Tab[] = [
  { key: 'acasa', label: 'Acasă', href: routes.home(), Icon: TabHomeIcon },
  { key: 'balti', label: 'Bălți', href: routes.lakes(), Icon: TabMapIcon },
  { key: 'concursuri', label: 'Competiții', href: routes.competitions(), Icon: TabTrophyIcon },
  { key: 'partide', label: 'Partide', href: PATHS.partide, Icon: TabFishIcon },
];

/** Public waters live in the Bălți tab. */
function tabKeyForPath(pathname: string): string | undefined {
  if (pathname.startsWith('/ape-publice')) return 'balti';
  return navKeyForPath(pathname);
}

/** fish: 49 + the bottom inset (React Navigation's iOS tab bar). */
const ROW = 'h-[49px]';
const SAFE_BOTTOM = 'pb-[env(safe-area-inset-bottom)]';

/**
 * Rendered after <main> in the shell. The pathname is request data on a dynamic route, so it is
 * read behind a boundary; dynamic routes are never tab roots, so the empty fallback is exact.
 */
export function BottomTabBar() {
  return (
    <Suspense fallback={null}>
      <WithPath />
    </Suspense>
  );
}

function WithPath() {
  const pathname = usePathname() ?? '/';
  const notFound = useIsNotFound(pathname);
  if (notFound || !isTabRoot(pathname)) return null;
  const active = tabKeyForPath(pathname);
  return (
    <>
      {/* In-flow spacer: the page's last row scrolls clear of the fixed bar. */}
      <div aria-hidden data-tab-bar-spacer className={cn('md:hidden', SAFE_BOTTOM)}>
        <div className={ROW} />
      </div>
      <nav
        aria-label="Navigare principală"
        data-tab-bar
        className={cn(
          'fixed inset-x-0 bottom-0 z-sticky rounded-t-card bg-surface md:hidden',
          // fish tabBarStyle: shadowOffset (0, 2), opacity .25, radius 3.84 (iOS).
          'shadow-[0_2px_3.84px_rgb(0_0_0/0.25)]',
          SAFE_BOTTOM,
        )}
      >
        <ul className={cn('flex', ROW)}>
          {TABS.map((t) => (
            <TabItem key={t.key} tab={t} pathname={pathname} active={active === t.key} />
          ))}
          {/* fish hides Profil when signed out; it appears once the session says signed in. */}
          <Suspense fallback={null}>
            <ProfileTab pathname={pathname} active={active === 'profil'} />
          </Suspense>
        </ul>
      </nav>
    </>
  );
}

const ITEM = 'flex h-full flex-col items-center pt-1.5 transition-opacity duration-(--duration-fast) ease-fast active:opacity-70';

function TabItem({ tab, pathname, active }: { tab: Tab; pathname: string; active: boolean }) {
  const { Icon } = tab;
  return (
    <li className="flex-1">
      <Link
        href={tab.href}
        aria-current={active ? currentKind(tab.href, pathname) : undefined}
        className={cn(ITEM, active ? 'text-accent' : 'text-muted')}
      >
        <Icon className="size-6 shrink-0" />
        <span className="t-micro mt-0.5">{tab.label}</span>
      </Link>
    </li>
  );
}

function ProfileTab({ pathname, active }: { pathname: string; active: boolean }) {
  const viewer = useShellViewer();
  if (viewer === null || isUnknownViewer(viewer)) return null;
  // fish: a 28px round avatar (logo_bluvi.png when there is no photo), a 1.5px accent border while
  // the tab is selected; the label takes the tab colour.
  // 28px in the 24px icon row: 4px over it, so «Profil» sits on the other labels' line (fish).
  const thumb = cn('-mt-1 size-7 shrink-0 rounded-full', active && 'border-[1.5px] border-accent');
  return (
    <li className="flex-1">
      <Link
        href={PATHS.profile}
        aria-current={active ? currentKind(PATHS.profile, pathname) : undefined}
        className={cn(ITEM, active ? 'text-accent' : 'text-muted')}
      >
        {viewer.avatarUrl ? (
          <AvatarPhoto
            src={viewer.avatarUrl}
            className={cn(thumb, 'relative inline-flex items-center justify-center overflow-hidden')}
            fallbackClassName="bg-accent-tint text-accent-ink text-initials-24"
            initials={getInitials(viewer.username)}
            a11y={{ 'aria-hidden': true }}
          />
        ) : (
          <span aria-hidden className={cn(thumb, 'flex items-center justify-center bg-surface text-accent-ink')}>
            <FishLogo className="size-6" />
          </span>
        )}
        <span className="t-micro mt-0.5">Profil</span>
      </Link>
    </li>
  );
}
