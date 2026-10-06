import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { SiteShell } from '../../../(site)/_shell/SiteShell';

/**
 * The T4 demo inside THE app shell (app/(site)/_shell/SiteShell.tsx): the skip link, the product's
 * top bar (Administrare for organisers and operators, ⌘K search, ☰ menu, the unread dot and the
 * phone hide-on-scroll that T4Header follows), <main> and the session read. Here, not in the page,
 * so the route's error boundary (error.tsx) renders inside the same chrome. `?state=signed-out`
 * forces the signed-out bar («Intră», no Administrare), as it forces the flow's sign-in gate.
 * No layout breadcrumb band: the T4 header owns the way back (SiteHeader ownsBreadcrumbBand).
 */
export default function T4DemoLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_KIT !== '1') notFound();
  return <SiteShell forced={{ param: 'state', out: ['signed-out'] }}>{children}</SiteShell>;
}
