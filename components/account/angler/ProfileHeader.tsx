'use client';

import { StarIcon } from '@heroicons/react/20/solid';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { FollowButton } from '@/components/cards/FollowButton';
import { Lightbox } from '@/components/surfaces/Lightbox';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { AvatarPhoto } from '@/components/ui/AvatarPhoto';
import { toneForId, toneForName } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { getInitials } from '@/components/ui/initials';
import { formatCount } from '@/core/realtime/chat/format';
import { ratingCountLabel, userReputationQuery, type AnglerProfile } from '@/core/social';
import { createBrowserTransport } from '@/lib/client/transport';
import { ButtonLink } from '@/components/ui/Button';
import { anglerConnectionsHref, routes } from '@/lib/routes';
import { BioText } from './BioText';
import { ReputationBlock } from './ReputationBlock';
import { StatBento, StatStrip } from './StatStrip';
import { TrophyRow } from './TrophyRow';
import { useFollowAngler } from './useFollowAngler';

/*
 * The angler's identity — fish components/profile/ProfileHeader.tsx (parity account.angler-profile
 * c4–c10, c14, c36; account.own-profile c4).
 *  - Phone / tablet: fish's centred column — the 100px avatar (initials when there is no photo; a
 *    photo opens full screen), the rating pill on its lower right when operators rated the angler
 *    (it opens the reputation panel), the name as the page's h1, «{n} urmăritori · {n} urmărește»,
 *    the trophy row, the four-column stat strip, the follow button (another angler only), the bio.
 *  - ≥1280 (T3 two columns, the left sticky identity card): avatar, name, counts, follow, bio, then
 *    the stats as small bento tiles — the podiums one of them (owner rules 9, 19) — and the
 *    reputation summary (the same panel), each in that order (CSS order on one DOM).
 * The follow button is fish's FollowButton (kit components/cards FollowButton look="profile") on
 * useFollowAngler; the counts open the connections page once the web has it (anglerConnectionsHref).
 */

const AVATAR_TONE: Record<string, string> = {
  indigo: 'bg-accent-tint text-accent-ink',
  tint: 'bg-accent-tint-2 text-accent-ink',
  success: 'bg-status-success-bg text-status-success-fg',
  warning: 'bg-status-warning-bg text-status-warning-fg',
  neutral: 'bg-status-neutral-bg text-status-neutral-fg',
};

/**
 * The 100px avatar (fish InitialsAvatar size 100): the kit Avatar's tones and initials, a step up. Also the edit-profile preview («Așa te văd ceilalți»).
 * `toneKey`: the angler's documentId, so the tone matches their connection rows and survives a rename (toneForId).
 */
export function BigAvatar({ name, src, toneKey }: { name: string; src: string | null; toneKey?: string }) {
  const base = 'relative inline-flex size-25 shrink-0 items-center justify-center overflow-hidden rounded-full t-title1 font-extrabold leading-none select-none';
  const tone = AVATAR_TONE[toneKey ? toneForId(toneKey) : toneForName(name)] ?? AVATAR_TONE.indigo;
  if (src) {
    return <AvatarPhoto src={src} className={base} fallbackClassName={tone} initials={getInitials(name)} a11y={{ 'aria-hidden': true }} />;
  }
  return (
    <span aria-hidden className={cn(base, tone)} data-testid="avatar-initials">
      {getInitials(name)}
    </span>
  );
}

export function ProfileHeader({ profile, mode, signedIn }: { profile: AnglerProfile; mode: 'own' | 'other'; signedIn: boolean }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const { data: reputation } = useQuery(userReputationQuery(t, profile.documentId));
  const rating = reputation?.avgStars ?? null;
  const [photoOpen, setPhotoOpen] = useState(false);
  const [reputationOpen, setReputationOpen] = useState(false);
  const follow = useFollowAngler(profile.documentId, { signedIn });
  const showFollow = mode === 'other' && !profile.isSelf;
  const ratingText = rating != null ? rating.toFixed(1).replace('.', ',') : null;

  return (
    <div className="flex flex-col items-center text-center" data-testid="profile-header">
      <div className="relative">
        {profile.avatarUrl ? (
          <button
            type="button"
            onClick={() => setPhotoOpen(true)}
            aria-label={`Vezi fotografia de profil a lui ${profile.username}`}
            className="flex cursor-pointer rounded-full transition-opacity duration-(--duration-fast) hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
            data-testid="profile-avatar-button"
          >
            <BigAvatar name={profile.username} src={profile.avatarUrl} toneKey={profile.documentId} />
          </button>
        ) : (
          <BigAvatar name={profile.username} src={null} toneKey={profile.documentId} />
        )}
        {ratingText ? (
          <button
            type="button"
            onClick={() => setReputationOpen(true)}
            aria-label={`Reputație: ${ratingText} din 5. Vezi evaluările`}
            aria-haspopup="dialog"
            className="absolute -right-2.5 -bottom-0.5 flex min-h-7 cursor-pointer items-center gap-0.75 rounded-full bg-surface px-2 shadow-e2 transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
            data-testid="profile-rating-pill"
          >
            <StarIcon aria-hidden className="size-3 text-rating" />
            <span className="t-label text-ink">{ratingText}</span>
          </button>
        ) : null}
      </div>

      <h1 className="mt-3 t-title2 break-words text-ink xl:t-title1" data-testid="profile-name">
        {profile.username}
      </h1>

      <p className="mt-1 flex flex-wrap items-center justify-center gap-1 t-caption text-muted" data-testid="profile-counts">
        <CountLink href={anglerConnectionsHref(profile.documentId, 'urmaritori')} n={profile.counts.followers} noun={['urmăritor', 'urmăritori']} testId="followers-count" />
        <span aria-hidden>·</span>
        <CountLink href={anglerConnectionsHref(profile.documentId, 'urmareste')} n={profile.counts.following} verb="urmărește" testId="following-count" />
      </p>

      {/* Phone / tablet: fish's inline row under the counts. ≥1280 the podium is its own bento tile
          (StatBento «Podiumuri»), never a small caption between the button and the bento. */}
      <TrophyRow podium={profile.podium} className="order-1 mt-2 xl:hidden" />
      <div className="order-2 w-full xl:hidden">
        <StatStrip profile={profile} />
      </div>

      {showFollow ? (
        <div className="order-3 mt-3.5 flex xl:order-1 xl:mt-4 xl:w-full" data-testid="follow-slot">
          <FollowButton
            look="profile"
            following={profile.isFollowedByMe}
            pending={follow.isPending}
            onToggle={follow.toggle}
            name={profile.username}
            className="xl:w-full"
          />
        </div>
      ) : null}
      {profile.isSelf ? (
        // The own profile's way to «Editează profilul» (/setari/profil) — in the follow button's place.
        <div className="order-3 mt-3.5 flex xl:order-1 xl:mt-4 xl:w-full" data-testid="edit-profile-slot">
          <ButtonLink href={routes.editProfile()} variant="secondary" className="xl:w-full">
            Editează profilul
          </ButtonLink>
        </div>
      ) : null}

      {profile.bio ? <BioText bio={profile.bio} className="order-4 mt-3.5 max-w-120 xl:order-2" /> : null}

      <div className="order-5 mt-5 hidden w-full text-left xl:block">
        <StatBento profile={profile} />
      </div>

      {ratingText && reputation ? (
        <button
          type="button"
          onClick={() => setReputationOpen(true)}
          aria-haspopup="dialog"
          className="order-6 mt-3 hidden min-h-12 w-full cursor-pointer items-center gap-2 rounded-control bg-page px-3.5 text-left transition-colors hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent xl:flex"
          data-testid="reputation-summary-row"
        >
          <StarIcon aria-hidden className="size-4 text-rating" />
          <span className="t-body-strong text-ink">{ratingText}</span>
          <span className="t-caption text-muted">· {ratingCountLabel(reputation.ratingCount)}</span>
          <span className="ms-auto flex items-center gap-0.5 t-button-compact text-accent-ink">
            Reputație
            <ChevronRightIcon aria-hidden className="size-4" />
          </span>
        </button>
      ) : null}

      {profile.avatarUrl ? (
        <Lightbox
          items={[{ key: 'avatar', src: profile.avatarUrl, alt: `Fotografia de profil a lui ${profile.username}` }]}
          index={photoOpen ? 0 : null}
          onIndex={i => setPhotoOpen(i != null)}
          total={1}
          label="Fotografie de profil"
          title={() => profile.username}
        />
      ) : null}

      <ResponsiveSurface open={reputationOpen} onClose={() => setReputationOpen(false)} intent="info" title="Reputație" sheetSnap="fit">
        <ReputationBlock userId={profile.documentId} heading={false} />
      </ResponsiveSurface>
    </div>
  );
}

/**
 * «{n} urmăritor / urmăritori / de urmăritori» (formatCount: the «de» from 20, owner rule on
 * plurals — fish's fixed «urmăritori» is not copied) with the figure in its own span; `verb` is
 * the following side, «{n} urmărește», which takes no plural.
 */
function CountLink({
  href,
  n,
  noun,
  verb,
  testId,
}: {
  href: string | null;
  n: number;
  noun?: [singular: string, plural: string];
  verb?: string;
  testId: string;
}): ReactNode {
  const rest = noun ? formatCount(n, noun[0], noun[1]).slice(String(n).length + 1) : (verb ?? '');
  const content = (
    <>
      <span className="t-label text-ink tabular-nums">{n}</span> {rest}
    </>
  );
  if (!href) {
    return (
      <span className="t-caption text-muted" data-testid={testId}>
        {content}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="inline-flex min-h-6 items-center gap-1 rounded-control t-caption text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
      data-testid={testId}
    >
      {content}
    </Link>
  );
}
