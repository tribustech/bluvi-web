import { Suspense } from 'react';
import { ASIDE, COLUMN, OWN_ACTIONS, PROFILE_GRID } from '@/components/account/angler/frame';
import { ProfileHeaderSkeleton } from '@/components/account/angler/ProfileSkeleton';
import { cn } from '@/components/ui/cn';
import { ON_WEB } from '@/lib/routes';
import { OwnProfileFallbackTabs, OwnProfileTabsSkeleton } from './OwnProfileFallbackTabs';

/*
 * /profil while the session and the first tab are read (loading.tsx and the page's Suspense) — fish
 * ProfileSkeleton in own mode (parity account.own-profile c4): the shape AnglerProfileView mode="own"
 * lands in, in grey, on the view's own frame classes (components/account/angler/frame.ts). Below
 * 1280 no chip row: the two ghost actions (the small refresh, the cog) float in the header band's
 * top-right corner (OWN_ACTIONS), the header starts at pt-4; from 1280 they sit at the tab card's end.
 * The header skeleton has no follow pill but the edit button's and trophy row's bones
 * (ProfileHeaderSkeleton mode="own"). The tab bar and the panel follow ?tab= (OwnProfileFallbackTabs),
 * so /profil?tab=sesiuni streams Partide cards with «Partide» underlined — nothing jumps on landing.
 */
export function OwnProfileFallback() {
  return (
    <div className="flex min-h-dvh flex-col pb-12" role="status" aria-label="Se încarcă profilul" data-testid="profile-fallback" data-mode="own">
      <h1 className="sr-only">Profilul meu</h1>
      <div className={PROFILE_GRID}>
        <div aria-hidden className={OWN_ACTIONS} data-testid="profile-header-row">
          {/* The ghost refresh's 20px glyph, then the ghost cog's 24px one, each centred in 44px. */}
          <span className="flex size-11 items-center justify-center">
            <span className="size-5 animate-shimmer rounded-full" />
          </span>
          {ON_WEB.settings ? (
            <span className="flex size-11 items-center justify-center" data-testid="settings-bone">
              <span className="size-6 animate-shimmer rounded-full" />
            </span>
          ) : null}
        </div>
        <div className={cn(ASIDE, 'pt-4')}>
          <ProfileHeaderSkeleton mode="own" />
        </div>
        <div className={COLUMN}>
          <Suspense fallback={<OwnProfileTabsSkeleton tab="capturi" />}>
            <OwnProfileFallbackTabs />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
