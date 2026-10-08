import type { ReactNode } from 'react';
import { TabsSkeleton } from '@/components/templates/T1';
import { DashboardHeader, DashboardPage, DashboardRefresh } from '@/components/templates/T5';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../_shell/SiteHeader';
import { CardSkeleton } from './cards';
import { BAND, GRID, PANEL_TITLE, PANEL_TRAIL } from './frame';
import { StatTilesSkeleton } from './stats';

/**
 * The panel's frame (header, breadcrumb from 768) around `children`: the loading skeleton and the
 * error boundary draw the real h1 and way back, so nothing at the top moves when the panel lands.
 */
export function PanelFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <SetBreadcrumb trail={PANEL_TRAIL} />
      <DashboardPage className="max-md:pb-28" header={<DashboardHeader title={PANEL_TITLE} back={{ href: routes.home(), label: 'Înapoi', inApp: true }} actions={<DashboardRefresh />} />}>
        {children}
      </DashboardPage>
    </>
  );
}

/** c5 / c16 — the first paint behind the gate: the tiles', the tabs' and three card rows' bones. */
export function PanelSkeleton() {
  return (
    <PanelFrame>
      <div role="status" className="flex flex-col gap-4 md:gap-5 xl:gap-6">
        <span className="sr-only">Se încarcă panoul…</span>
        <StatTilesSkeleton />
        <div className="flex flex-col">
          <div className="flex h-12 items-end">
            <span aria-hidden className="h-5 w-40 animate-shimmer rounded-full" />
          </div>
          <div className={cn(BAND, 'static pt-3 pb-3')}>
            <TabsSkeleton count={5} />
          </div>
          <ul aria-hidden className={cn(GRID, 'pt-2')}>
            {Array.from({ length: 6 }, (_, i) => (
              <CardSkeleton key={i} />
            ))}
          </ul>
        </div>
      </div>
    </PanelFrame>
  );
}
