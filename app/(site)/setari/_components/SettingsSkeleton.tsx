import { SettingsCard, SettingsRowSkeleton, SettingsSectionLabelSkeleton } from '@/components/account/settings';
import { SettingsColumns, SettingsFrame } from './SettingsFrame';

/**
 * c1 loading (fish LoadingScreen, the whole screen): the header in place and every card in its own
 * geometry and column, so nothing moves when the profile lands. The live line «Se încarcă
 * setările…» is the frame's status, outside the aria-busy cards.
 */
export function SettingsSkeleton() {
  const bar = (w: string) => <span className={`block h-4 ${w} animate-shimmer rounded-full`} />;
  return (
    <SettingsFrame busy status="Se încarcă setările…">
      <div aria-hidden data-testid="settings-skeleton">
        <SettingsColumns
          profile={
            <SettingsCard>
              <div className="flex min-h-20 items-center gap-3 px-4 py-3.5 md:px-5">
                <span className="size-12 shrink-0 animate-shimmer rounded-full" />
                <span className="flex flex-1 flex-col gap-2">
                  {bar('w-36')}
                  <span className="block h-3 w-48 max-w-[80%] animate-shimmer rounded-full" />
                </span>
              </div>
            </SettingsCard>
          }
          actions={
            <SettingsCard>
              <SettingsRowSkeleton helper={false} />
              <SettingsRowSkeleton helper={false} />
            </SettingsCard>
          }
          reputation={
            <SettingsCard className="flex flex-col gap-4 p-5">
              <span className="block h-6 w-28 animate-shimmer rounded-full" />
              <span className="block h-10 w-24 animate-shimmer rounded-control" />
            </SettingsCard>
          }
          info={
            <div className="flex flex-col gap-2">
              <SettingsSectionLabelSkeleton />
              <SettingsCard>
                {[0, 1, 2, 3].map((i) => (
                  <SettingsRowSkeleton key={i} trailing="none" helper={false} />
                ))}
              </SettingsCard>
            </div>
          }
          legal={
            <SettingsCard>
              <SettingsRowSkeleton helper={false} />
              <SettingsRowSkeleton helper={false} />
            </SettingsCard>
          }
          contact={<span className="block h-12 animate-shimmer rounded-card" />}
          leave={<span className="block h-13 animate-shimmer rounded-card" />}
        />
      </div>
    </SettingsFrame>
  );
}
