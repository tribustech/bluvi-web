import type { ReactNode } from 'react';
import { SiteShell } from '../../../(site)/_shell/SiteShell';

/**
 * The T5 demo inside THE app shell (app/(site)/_shell/SiteShell.tsx — the skip link, the top bar,
 * the breadcrumb band from 768, where DashboardHeader drops its back button, and the session read),
 * so every state is measured and screenshotted on the page it will live on. `?state=signed-out`
 * forces the signed-out bar, as it forces the page's sign-in state.
 */
export default function T5DemoLayout({ children }: { children: ReactNode }) {
  return <SiteShell forced={{ param: 'state', out: ['signed-out'] }}>{children}</SiteShell>;
}
