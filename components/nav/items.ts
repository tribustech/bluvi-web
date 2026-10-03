import type { ComponentType, SVGProps } from 'react';
import {
  ArrowRightEndOnRectangleIcon,
  HomeIcon,
  MapIcon,
  TrophyIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { routes } from '@/lib/routes';
import { FishIcon } from '@/components/icons/brand';

/**
 * Primary navigation — order and labels mirror fish app/(app)/(tabs)/_layout.tsx
 * and the Fundații nav (Acasă, Bălți, Competiții, Partide, Profil). The route stays /concursuri.
 * The last slot is «Profil» only when signed in; signed out it becomes «Intră» (Fundații §07). Tab bar, rail and side menu all read this list.
 */
export type NavKey = 'acasa' | 'balti' | 'concursuri' | 'partide' | 'profil' | 'intra';

export type NavItem = {
  key: NavKey;
  label: string;
  href: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

// /partide, /profil and /intra are not in lib/routes.ts yet; the app shell phase owns those pages.
const BASE: NavItem[] = [
  { key: 'acasa', label: 'Acasă', href: routes.home(), Icon: HomeIcon },
  { key: 'balti', label: 'Bălți', href: routes.lakes(), Icon: MapIcon },
  { key: 'concursuri', label: 'Competiții', href: routes.competitions(), Icon: TrophyIcon },
  { key: 'partide', label: 'Partide', href: '/partide', Icon: FishIcon },
];
const PROFILE: NavItem = { key: 'profil', label: 'Profil', href: '/profil', Icon: UserCircleIcon };
const SIGN_IN: NavItem = { key: 'intra', label: 'Intră', href: '/intra', Icon: ArrowRightEndOnRectangleIcon };

export function primaryNav(signedIn: boolean): NavItem[] {
  return [...BASE, signedIn ? PROFILE : SIGN_IN];
}

/** Maps a pathname to the primary nav key it belongs to (for the thin client wrapper). */
export function navKeyForPath(pathname: string): NavKey | undefined {
  const first = `/${pathname.split('/')[1] ?? ''}`;
  if (first === '/') return 'acasa';
  const hit = [...BASE, PROFILE, SIGN_IN].find((i) => i.href !== '/' && i.href === first);
  return hit?.key;
}

/** «ADMINISTRARE» group in the side menu: organiser and lake-operator shortcuts. */
export type AdminLink = { key: string; label: string; href: string };
