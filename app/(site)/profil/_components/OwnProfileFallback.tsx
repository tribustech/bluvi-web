import { ProfileHeaderSkeleton, ProfileTabSkeleton } from '@/components/account/angler/ProfileSkeleton';
import { cn } from '@/components/ui/cn';
import { ON_WEB } from '@/lib/routes';

/*
 * /profil while the session and the first tab are read (loading.tsx and the page's Suspense) — fish
 * ProfileSkeleton in own mode (parity account.own-profile c4): the shape AnglerProfileView mode="own"
 * lands in, in grey. Below 1280 the header row holds the refresh and settings chips on the RIGHT
 * (no back control, c3; the settings chip only once /setari exists, ON_WEB.settings) — while refresh
 * would be alone there is no row: its bone sits in the header band's top-right corner, as the view's
 * chip does. From 1280 there is no such row (they live at the tab bar's end). The header skeleton has no follow pill but the
 * edit button's and trophy row's bones (ProfileHeaderSkeleton mode="own"), so nothing shifts.
 */
export function OwnProfileFallback() {
  return (
    <div className="flex min-h-dvh flex-col pb-12" role="status" aria-label="Se încarcă profilul" data-testid="profile-fallback" data-mode="own">
      <h1 className="sr-only">Profilul meu</h1>
      <div className="relative flex flex-col xl:grid xl:grid-cols-[--spacing(90)_minmax(0,1fr)] xl:items-start xl:gap-x-6 xl:px-8 2xl:grid-cols-[--spacing(100)_minmax(0,1fr)]">
        <div
          aria-hidden
          className={cn(
            'flex items-center justify-end gap-2 xl:hidden',
            ON_WEB.settings ? 'min-h-14 bg-surface px-4 pt-2 md:px-6' : 'absolute top-2 right-4 z-above md:right-6',
          )}
        >
          <span className="size-12 animate-shimmer rounded-control" />
          {ON_WEB.settings ? <span className="size-12 animate-shimmer rounded-control" /> : null}
        </div>
        <div className={cn('bg-surface px-5 pb-5 md:px-6 xl:mt-4 xl:rounded-card xl:p-6 xl:shadow-e0', ON_WEB.settings ? 'pt-1' : 'pt-4')}>
          <ProfileHeaderSkeleton mode="own" />
        </div>
        <div className="flex min-w-0 flex-col xl:mt-4">
          <div aria-hidden className="flex items-center gap-2 bg-surface md:px-6 xl:rounded-card xl:px-5 xl:pt-1.5 xl:shadow-e0">
            <div className="flex min-h-11 flex-1 items-end gap-6 border-b border-hairline pb-2.5 max-md:justify-around md:gap-7 xl:border-b-0">
              {['w-16', 'w-16', 'w-22'].map((w, i) => (
                <span key={i} className={cn('h-3.5 animate-shimmer rounded-control', w)} />
              ))}
            </div>
            {/* ≥1280 the refresh and settings chips sit at the tab bar's end. */}
            <span className="size-10 animate-shimmer rounded-control max-xl:hidden" />
            {ON_WEB.settings ? <span className="size-10 animate-shimmer rounded-control max-xl:hidden" /> : null}
          </div>
          <div className="md:px-6 md:pt-4 xl:px-0">
            <ProfileTabSkeleton tab="capturi" />
          </div>
        </div>
      </div>
    </div>
  );
}
