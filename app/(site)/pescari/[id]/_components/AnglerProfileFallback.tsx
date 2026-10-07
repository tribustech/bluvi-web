import { ProfileHeaderSkeleton, ProfileTabSkeleton } from '@/components/account/angler/ProfileSkeleton';
import { cn } from '@/components/ui/cn';

/*
 * While the session and the first tab are read (loading.tsx and the page's Suspense): the profile's
 * own shape in grey — the top row, the header skeleton (with the follow pill: another angler's
 * profile), the tab bar's three labels and the Capturi grid — so nothing jumps when it lands.
 */
export function AnglerProfileFallback() {
  return (
    <div className="flex min-h-dvh flex-col pb-12" role="status" aria-label="Se încarcă profilul" data-testid="profile-fallback">
      <h1 className="sr-only">Profil de pescar</h1>
      <div className="flex flex-col xl:grid xl:grid-cols-[--spacing(90)_minmax(0,1fr)] xl:items-start xl:gap-x-6 xl:px-8 2xl:grid-cols-[--spacing(100)_minmax(0,1fr)]">
        <div className="flex min-h-14 items-center bg-surface px-4 pt-2 md:px-6 xl:col-span-2 xl:bg-transparent xl:px-0 xl:pt-4 xl:pb-2">
          <span aria-hidden className="size-12 animate-shimmer rounded-control md:size-10" />
        </div>
        <div className="bg-surface px-5 pt-1 pb-5 md:px-6 xl:rounded-card xl:p-6 xl:shadow-e0">
          <ProfileHeaderSkeleton mode="other" />
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="bg-surface md:px-6 xl:bg-transparent xl:px-0">
            <div aria-hidden className="flex min-h-11 items-end gap-6 border-b border-hairline pb-2.5 max-md:justify-around md:gap-7">
              {['w-16', 'w-16', 'w-22'].map((w, i) => (
                <span key={i} className={cn('h-3.5 animate-shimmer rounded-control', w)} />
              ))}
            </div>
          </div>
          <div className="md:px-6 md:pt-4 xl:px-0">
            <ProfileTabSkeleton tab="capturi" />
          </div>
        </div>
      </div>
    </div>
  );
}
