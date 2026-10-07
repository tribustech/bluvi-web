'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFollowAngler } from '@/components/account/angler/useFollowAngler';
import { FollowButton } from '@/components/cards/FollowButton';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import type { CommunityMemberDTO } from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';
import { anglerProfileQuery } from '@/core/social';
import { createBrowserTransport } from '@/lib/client/transport';
import { anglerHref } from '@/lib/routes';

/*
 * One row of «Pescari» — fish comunitate/[id].tsx AnglerRow (parity partide.spectator.c8): the
 * avatar (photo, or initials on the member's tone) in fish's gradient ring, the name (or «Pescar»)
 * linking to the angler profile, «N urmăritori» and a follow button.
 *  - One anglerProfileQuery per member (fish useAnglerProfile), only for a signed-in viewer
 *    (GET /feed/anglers/:id answers 401 signed out). It gives the follower count and the follow
 *    state; until it answers, neither is shown (owner rule 4).
 *  - Signed out: no count (unknown) and no follow button — fish shows the member follow only with
 *    a profile (comunitate/[id].tsx `profile &&`). On the spectator page the bell «Urmărește» (the
 *    partidă's notifications) stays the one filled CTA; three more filled «Urmărește» for a guest
 *    would bury it and read as the same action. The guest follows an angler from their profile.
 *  - The viewer's own row: no button (fish `!profile.isSelf`).
 *  - `signedIn` null: the session is not known yet (the shell's read is pending, or it failed) —
 *    the name and avatar only, no count and no button (owner rule 4).
 * The follow button reads the session (useFollowAngler): it is only mounted once it is known.
 */

export function MemberRow({ member, signedIn, viewerUid }: { member: CommunityMemberDTO; signedIn: boolean | null; viewerUid: string | null }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const name = member.name?.trim() || 'Pescar';
  const { data: profile } = useQuery(anglerProfileQuery(t, member.uid || undefined, { isAuthenticated: signedIn === true }));
  const self = member.uid === viewerUid || profile?.isSelf === true;
  const href = member.uid ? anglerHref(member.uid) : null;
  const showFollow = signedIn === true && !!member.uid && !self && !!profile;
  const followers = signedIn && profile ? profile.counts.followers : null;
  return (
    <li data-testid="partida-member" className="relative flex items-center gap-3 px-4 py-2.75 md:px-5 xl:px-6">
      {/* fish: indigo → violet → teal gradient ring around a white gap. */}
      <span aria-hidden className="shrink-0 rounded-full bg-linear-135 from-accent via-bento-violet to-success p-0.5">
        <Avatar name={name} src={member.avatarUrl} size={40} ring />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {href ? (
          <Link
            href={href}
            className={cn(
              'truncate t-body-strong text-ink hover:underline',
              // The whole row opens the profile (fish row tap); the follow button sits above it.
              "after:absolute after:inset-0 after:content-['']",
              'focus-visible:outline-none focus-visible:after:rounded-control focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent',
            )}
          >
            {name}
            {self ? <span className="t-caption text-muted"> (tu)</span> : null}
          </Link>
        ) : (
          <span className="truncate t-body-strong text-ink">{name}</span>
        )}
        {followers != null ? <span className="t-caption text-muted">{formatCount(followers, 'urmăritor', 'urmăritori')}</span> : null}
      </span>
      {showFollow ? <MemberFollow uid={member.uid} name={name} signedIn={!!signedIn} following={profile?.isFollowedByMe ?? false} /> : null}
    </li>
  );
}

function MemberFollow({ uid, name, signedIn, following }: { uid: string; name: string; signedIn: boolean; following: boolean }) {
  const follow = useFollowAngler(uid, { signedIn });
  return <FollowButton look="profile" size="compact" name={name} following={following} pending={follow.isPending} onToggle={follow.toggle} />;
}
