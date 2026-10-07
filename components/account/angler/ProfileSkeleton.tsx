import { cn } from '@/components/ui/cn';
import { CATCH_GRID } from './frame';

/*
 * fish components/profile/ProfileSkeleton.tsx — the header and each tab in grey, shaped like what
 * lands so nothing shifts (parity account.angler-profile c3, c31; account.own-profile c4).
 *  - ProfileHeaderSkeleton: phone — the 100px avatar circle, the name bar, the followers bar, four
 *    stat columns and, in `other` mode, the follow pill. Own mode has no follow pill (c4) but the web
 *    own header always lands «Editează profilul» in its slot, so own mode reserves that button and
 *    the trophy row (account.own-profile c4: the tab bar does not move when the header lands). From
 *    1280 the identity card's shape: avatar, name, counts, the full-width follow / edit button, the
 *    trophy row (own), then StatBento's tiles (wide signature, two halves, one wide). The `order-*`
 *    classes are ProfileHeader's, so each bone sits where its real block lands at every width.
 *  - ProfileTabSkeleton: Capturi four rows of three squares (the grid's own columns from 768),
 *    Sesiuni a month bar + three cards, Concursuri three cards.
 * Decorative: the region around it says «Se încarcă…» (aria-busy + a status line).
 */

const BONE = 'animate-shimmer';

export function ProfileHeaderSkeleton({ mode }: { mode: 'own' | 'other' }) {
  // No padding of its own: the container (the aside / AnglerProfileFallback's band) owns it, as it
  // does for the real header — so the tab bar does not move when the profile lands.
  return (
    <div aria-hidden data-testid="profile-header-skeleton" className="flex flex-col items-center">
      <span className={cn('size-25 rounded-full', BONE)} />
      <span className={cn('mt-3 h-5.5 w-35 rounded-control xl:h-8.5', BONE)} />
      {/* The counts line: its two links are 24px targets (ProfileHeader CountLink min-h-6). */}
      <span className="mt-1 flex h-6 items-center">
        <span className={cn('h-3.5 w-45 rounded-control', BONE)} />
      </span>
      {/* Own: the trophy row (ProfileHeader TrophyRow, order-1; one t-body line). ≥1280 the podium is a bento tile, no row. */}
      {mode === 'own' ? <span className={cn('order-1 mt-2 h-5 w-30 rounded-control md:h-5.5 xl:hidden', BONE)} data-testid="trophy-skeleton" /> : null}
      <span className="order-2 mt-3.5 flex w-full xl:hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className={cn('h-5 w-9 rounded-control', BONE)} />
            <span className={cn('h-2.5 w-12.5 rounded-control', BONE)} />
          </span>
        ))}
      </span>
      {/* The follow pill: under the strip on the phone; at ≥1280 (no strip) under the counts, full width — the real card's order. */}
      {mode === 'other' ? <span className={cn('order-3 mt-3.5 h-10 w-36 rounded-control xl:order-1 xl:mt-4 xl:w-full', BONE)} data-testid="follow-skeleton" /> : null}
      {/* Own: «Editează profilul» in the follow button's slot (the kit Button: 48 / 40 from 1280). */}
      {mode === 'own' ? <span className={cn('order-3 mt-3.5 h-12 w-36 rounded-control xl:order-1 xl:mt-4 xl:h-10 xl:w-full', BONE)} data-testid="edit-skeleton" /> : null}
      {/* StatBento's shape: the wide C.M.M.C signature tile, two half tiles, one wide tile. */}
      <span className="order-5 mt-5 hidden w-full grid-cols-2 gap-2.5 xl:grid">
        <span className={cn('col-span-2 h-39 rounded-card', BONE)} />
        <span className={cn('h-23 rounded-card', BONE)} />
        <span className={cn('h-23 rounded-card', BONE)} />
        <span className={cn('col-span-2 h-23 rounded-card', BONE)} />
      </span>
    </div>
  );
}

export function ProfileTabSkeleton({ tab }: { tab: 'capturi' | 'sesiuni' | 'concursuri' }) {
  if (tab === 'capturi') {
    return (
      <div aria-hidden data-testid="tab-skeleton-capturi" className={cn(CATCH_GRID, 'max-md:[&>*:nth-child(n+13)]:hidden md:[&>*:nth-child(n+17)]:hidden')}>
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} className={cn('aspect-square md:rounded-control', BONE)} />
        ))}
      </div>
    );
  }
  if (tab === 'sesiuni') {
    return (
      <div aria-hidden data-testid="tab-skeleton-sesiuni" className="flex flex-col gap-3.5 px-4 pt-4 md:px-0">
        <span className={cn('h-3 w-25 rounded-control', BONE)} />
        <div className="grid gap-3.5 md:grid-cols-[repeat(auto-fill,minmax(--spacing(80),1fr))]">
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} className={cn('h-56 rounded-card', BONE)} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div aria-hidden data-testid="tab-skeleton-concursuri" className="grid gap-3 px-4 pt-3 md:grid-cols-[repeat(auto-fill,minmax(--spacing(90),1fr))] md:px-0">
      {Array.from({ length: 3 }, (_, i) => (
        <span key={i} className={cn('h-27.5 rounded-card', BONE)} />
      ))}
    </div>
  );
}
