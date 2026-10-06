import type { ComponentType, SVGProps } from 'react';
import {
  ArrowRightEndOnRectangleIcon,
  ChartBarSquareIcon,
  ClipboardDocumentListIcon,
  HomeIcon,
  MapIcon,
  TrophyIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { routes } from '@/lib/routes';
import { FishOutlineIcon } from './brand';

/**
 * Primary navigation — order and labels mirror fish app/(app)/(tabs)/_layout.tsx (Acasă, Bălți,
 * Competiții, Partide, Profil). The route stays /concursuri. The top bar and the phone menu show
 * the four sections; the phone menu adds the account group when signed in, «Intră în cont» when not.
 */
export type NavKey = 'acasa' | 'balti' | 'concursuri' | 'partide' | 'profil' | 'intra';

export type NavItem = {
  key: NavKey;
  label: string;
  href: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const PATHS = {
  partide: routes.partide(),
  profile: routes.profile(),
  settings: routes.settings(),
  notifications: routes.notifications(),
  signIn: routes.signIn(),
  organizer: routes.organizer(),
  operator: (lakeId: string) => routes.operator(lakeId),
} as const;

/**
 * The sign-in URL that returns to `next` (a path with its query) — /intra validates it as a safe
 * path. Without `next`, or for the home page and /intra itself, plain /intra (lib/routes.ts signIn).
 */
export const signInPath = (next?: string): string => routes.signIn(next);

export const SECTIONS: NavItem[] = [
  { key: 'acasa', label: 'Acasă', href: routes.home(), Icon: HomeIcon },
  { key: 'balti', label: 'Bălți', href: routes.lakes(), Icon: MapIcon },
  { key: 'concursuri', label: 'Competiții', href: routes.competitions(), Icon: TrophyIcon },
  { key: 'partide', label: 'Partide', href: PATHS.partide, Icon: FishOutlineIcon },
];
export const PROFILE_ITEM: NavItem = { key: 'profil', label: 'Profil', href: PATHS.profile, Icon: UserCircleIcon };
export const SIGN_IN_ITEM: NavItem = { key: 'intra', label: 'Intră', href: PATHS.signIn, Icon: ArrowRightEndOnRectangleIcon };

/** Maps a pathname to the primary nav key it belongs to. */
export function navKeyForPath(pathname: string): NavKey | undefined {
  const first = `/${pathname.split('/')[1] ?? ''}`;
  if (first === '/') return 'acasa';
  return [...SECTIONS, PROFILE_ITEM, SIGN_IN_ITEM].find((i) => i.href !== '/' && i.href === first)?.key;
}

/**
 * «Administrare» entries: organiser («Concursurile mele») and lake-operator shortcuts. A lake's entry
 * is labelled with the lake's name (long names wrap to two lines, never truncated) and says what it
 * opens in `caption` («Panou baltă»), so the role is never the part that gets cut off.
 */
export type AdminLink = { key: string; label: string; caption?: string; href: string; Icon?: NavItem['Icon'] };

/** What the chrome knows about the viewer's admin roles (lib/server/viewer.ts fills it). */
export type AdminRoles = { isOrganizer: boolean; ownedLakes: { documentId: string; name: string }[] };

/** fish: organiser = role «Organizer» (useOrganizerDashboard); operator = owns a lake (/feed/owned-lakes). */
export function adminLinks({ isOrganizer, ownedLakes }: AdminRoles): AdminLink[] {
  return [
    ...(isOrganizer
      ? [{ key: 'organizator', label: 'Concursurile mele', caption: 'Organizator', href: PATHS.organizer, Icon: ClipboardDocumentListIcon }]
      : []),
    ...ownedLakes.map((l) => ({
      key: `operator-${l.documentId}`,
      label: l.name,
      caption: 'Panou baltă',
      href: PATHS.operator(l.documentId),
      Icon: ChartBarSquareIcon,
    })),
  ];
}

/**
 * Whether the current page IS the entry's page (aria-current="page") or only lies below it
 * (aria-current="true": a parent section — /concursuri on /concursuri/<id>).
 */
export function currentKind(href: string, pathname: string | undefined): 'page' | 'true' {
  return pathname === href ? 'page' : 'true';
}

/** The admin link the current page belongs to, if any. */
export function activeAdminKey(admin: AdminLink[], pathname: string): string | undefined {
  return admin.find((a) => pathname === a.href || pathname.startsWith(`${a.href}/`))?.key;
}
