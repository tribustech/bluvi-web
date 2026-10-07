import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { ROW_FOCUS, SETTINGS_CARD } from '@/components/account/settings';
import { Avatar, toneForId } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import type { Profile } from '@/core/social';
import { routes } from '@/lib/routes';
import { avatarThumb, DASH } from './format';

export const USERNAME_PLACEHOLDER = 'Nume de utilizator';

/**
 * c3 (fish settings.tsx:169-193): the profile card — the avatar thumb (initials on the angler's tone
 * without one, fish InitialsAvatar), the username («Nume de utilizator» when empty) and the email
 * («-»), a chevron; the whole card is one link to «Editează profilul» (account.edit-profile.c17).
 * Its accessible name is the username; the email is its description.
 */
export function ProfileCardRow({ profile }: { profile: Profile }) {
  const name = profile.username || USERNAME_PLACEHOLDER;
  const email = profile.email || DASH;
  return (
    <Link
      href={routes.editProfile()}
      data-testid="settings-profile-card"
      aria-label={`${name}, editează profilul`}
      className={cn(
        SETTINGS_CARD,
        ROW_FOCUS,
        'flex min-h-20 items-center gap-3 px-4 py-3.5 transition-colors duration-(--duration-fast) ease-fast hover:bg-soft-fill active:bg-soft-fill md:px-5',
      )}
    >
      <Avatar name={profile.username || '?'} src={avatarThumb(profile)} size={48} tone={toneForId(profile.documentId)} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate t-heading text-ink">{name}</span>
        <span className="truncate t-caption text-muted">{email}</span>
      </span>
      <ChevronRightIcon aria-hidden className="size-6 shrink-0 text-ink-2" />
    </Link>
  );
}
