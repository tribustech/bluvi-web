import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { SiteShell } from '../../../(site)/_shell/SiteShell';

/** The operator booking-actions harness inside THE app shell (toast host, top bar). Dev only. */
export default function OperatorActionsHarnessLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_KIT !== '1') notFound();
  return <SiteShell>{children}</SiteShell>;
}
