'use client';

import { useSearchParams } from 'next/navigation';
import { PANEL, TAB_BAR, TAB_BAR_END, TAB_ROW } from '@/components/account/angler/frame';
import { ProfileTabSkeleton } from '@/components/account/angler/ProfileSkeleton';
import { parseProfileTab, PROFILE_TABS, type ProfileTab } from '@/components/account/angler/tabs';
import { cn } from '@/components/ui/cn';
import { ON_WEB } from '@/lib/routes';

/*
 * The fallback's right column for the tab in the URL (account.own-profile c4): /profil?tab=sesiuni
 * streams the Partide cards' bones, not the Capturi grid, and the tab bar's selected bone carries
 * the accent underline the landed ListTabs draws — so neither the panel nor the selection jumps.
 * Its own client island (useSearchParams) inside OwnProfileFallback's Suspense; before the params
 * are known (the prerendered shell) it is OwnProfileTabsSkeleton tab="capturi", the default tab.
 */
export function OwnProfileFallbackTabs() {
  return <OwnProfileTabsSkeleton tab={parseProfileTab(useSearchParams()?.get('tab'))} />;
}

/** Label widths of «Capturi», «Partide», «Concursuri». */
const LABEL_W: Record<ProfileTab, string> = { capturi: 'w-16', sesiuni: 'w-16', concursuri: 'w-22' };

export function OwnProfileTabsSkeleton({ tab }: { tab: ProfileTab }) {
  return (
    <div className="contents" data-testid="tab-skeleton" data-tab={tab}>
      <div className={TAB_BAR} data-testid="tab-bar-skeleton">
        <div aria-hidden className={cn('flex gap-6 border-b border-hairline md:gap-7', TAB_ROW)}>
          {PROFILE_TABS.map(key => (
            <span
              key={key}
              data-selected={key === tab || undefined}
              className={cn(
                'relative -mb-px flex min-h-11 shrink-0 items-center pb-2.5',
                "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:content-['']",
                key === tab ? 'after:bg-accent' : 'after:bg-transparent',
              )}
            >
              <span className={cn('h-3.5 animate-shimmer rounded-control', LABEL_W[key])} />
            </span>
          ))}
        </div>
        <span className="flex-1 max-xl:hidden" />
        {/* ≥1280 the refresh and settings chips at the tab card's end (40px). */}
        <div aria-hidden className={TAB_BAR_END}>
          <span className="size-10 animate-shimmer rounded-control" />
          {ON_WEB.settings ? <span className="size-10 animate-shimmer rounded-control" data-testid="settings-bone" /> : null}
        </div>
      </div>
      <div className={PANEL}>
        <ProfileTabSkeleton tab={tab} />
      </div>
    </div>
  );
}
