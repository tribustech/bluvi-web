import { ASIDE, COLUMN, HEADER_ROW, HEADER_ROW_BAND, PANEL, PROFILE_GRID, TAB_BAR, TAB_BAR_END, TAB_ROW } from '@/components/account/angler/frame';
import { ProfileHeaderSkeleton, ProfileTabSkeleton } from '@/components/account/angler/ProfileSkeleton';
import { cn } from '@/components/ui/cn';

/*
 * While the session and the first tab are read (loading.tsx and the page's Suspense): the profile's
 * own shape in grey, on AnglerProfileView's frame (components/account/angler/frame.ts — the same
 * classes, so nothing jumps when it lands, c3): below 1280 the chip row (back · refresh), the
 * header skeleton (with the follow pill: another angler's profile), the tab bar's three labels and
 * the Capturi grid (c31); from 1280 no chip row, the identity card and the tab card (with the
 * refresh chip at its end) side by side under the site header.
 */
const BONE = 'animate-shimmer';

export function AnglerProfileFallback() {
  return (
    <div className="flex min-h-dvh flex-col pb-12" role="status" aria-label="Se încarcă profilul" data-testid="profile-fallback">
      <h1 className="sr-only">Profil de pescar</h1>
      <div className={PROFILE_GRID}>
        <div aria-hidden className={cn(HEADER_ROW, HEADER_ROW_BAND)} data-testid="profile-header-row">
          {/* DetailBackButton (48px below 1280). */}
          <span className={cn('size-12 rounded-control', BONE)} />
          <span className="flex-1" />
          {/* DashboardRefresh: the icon chip on the phone, the labelled ghost button from 768. */}
          <span className={cn('size-12 rounded-control md:hidden', BONE)} />
          <span className={cn('h-12 w-42 rounded-control max-md:hidden', BONE)} />
        </div>
        <div className={cn(ASIDE, 'pt-1')}>
          <ProfileHeaderSkeleton mode="other" />
        </div>
        <div className={COLUMN}>
          <div className={TAB_BAR} data-testid="tab-bar-skeleton">
            <div aria-hidden className={cn('flex gap-6 border-b border-shimmer md:gap-7', TAB_ROW)}>
              {['w-16', 'w-16', 'w-22'].map((w, i) => (
                <span key={i} className="-mb-px flex min-h-11 shrink-0 items-center pb-2.5">
                  <span className={cn('h-3.5 rounded-control', BONE, w)} />
                </span>
              ))}
            </div>
            <span className="flex-1 max-xl:hidden" />
            {/* ≥1280 the refresh chip at the tab card's end (RefreshChip, 40px). */}
            <div aria-hidden className={TAB_BAR_END}>
              <span className={cn('size-10 rounded-control', BONE)} />
            </div>
          </div>
          <div className={PANEL}>
            <ProfileTabSkeleton tab="capturi" />
          </div>
        </div>
      </div>
    </div>
  );
}
