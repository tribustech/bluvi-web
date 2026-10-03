import Link from 'next/link';
import { BellIcon } from '@heroicons/react/24/outline';
import { Avatar } from '@/components/ui/Avatar';
import { ButtonLink } from '@/components/ui/Button';
import { SearchField } from './SearchField';

export type Crumb = { label: string; href?: string };

type Props = {
  /** Trail ending in the current page (the last crumb is never a link). */
  breadcrumb: Crumb[];
  /** Signed-in user (avatar photo or initials); omit when signed out. */
  user?: { name: string; avatarUrl?: string | null };
  /** Signed out: where «Intră» goes. Omit to show nothing in place of the avatar (e.g. while the session loads). */
  signInHref?: string;
  avatarHref?: string;
  notificationsHref?: string;
  hasUnread?: boolean;
  searchAction?: string;
  className?: string;
};

/**
 * Desktop header (≥768): breadcrumb (orientation + SEO), global ⌘K search, notifications and the
 * avatar. On mobile the screen draws its own header (translucent BackButton over the photo).
 */
export function DesktopHeader({
  breadcrumb,
  user,
  avatarHref = '/profil',
  notificationsHref = '/notificari',
  hasUnread = false,
  searchAction,
  signInHref,
  className = '',
}: Props) {
  const current = breadcrumb.at(-1);
  const trail = breadcrumb.slice(0, -1);
  return (
    <header className={`flex h-16 items-center gap-3.5 bg-surface px-5 shadow-e0 ${className}`}>
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-baseline gap-1">
          {trail.map((c) => (
            <li key={c.label} className="t-caption flex shrink-0 items-baseline gap-1 text-muted">
              {c.href ? (
                <Link href={c.href} className="rounded-badge hover:text-ink">
                  {c.label}
                </Link>
              ) : (
                c.label
              )}
              <span aria-hidden>/</span>
            </li>
          ))}
          {current ? (
            <li aria-current="page" className="t-body-strong min-w-0 truncate pl-1 text-ink">
              {current.label}
            </li>
          ) : null}
        </ol>
      </nav>
      <SearchField action={searchAction} className="w-[280px] shrink-0" />
      {user ? (
        <>
          <Link
            href={notificationsHref}
            aria-label={hasUnread ? 'Notificări, ai notificări noi' : 'Notificări'}
            className="relative flex size-10 shrink-0 items-center justify-center rounded-control bg-soft-fill text-ink transition-colors duration-(--duration-fast) hover:bg-hairline"
          >
            <BellIcon className="size-5" aria-hidden />
            {hasUnread ? (
              <span aria-hidden className="absolute top-2 right-[9px] size-2 rounded-full border-2 border-soft-fill bg-live" />
            ) : null}
          </Link>
          <Link href={avatarHref} aria-label="Profilul meu" className="shrink-0 rounded-full">
            <Avatar name={user.name} src={user.avatarUrl} size={40} tone="indigo" />
          </Link>
        </>
      ) : signInHref ? (
        <ButtonLink href={signInHref} variant="secondary" className="shrink-0">
          Intră
        </ButtonLink>
      ) : null}
    </header>
  );
}
