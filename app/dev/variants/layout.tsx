import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { SiteShell } from '../../(site)/_shell/SiteShell';

/**
 * /dev/variants/** — layout prototypes for the owner to compare side by side (not shipped). Inside
 * THE app shell, so the top bar, widths and gutters are the product's. Dev only: 404 in production
 * builds unless the dev kit is enabled, like /dev/templates.
 */
export default function VariantsLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_KIT !== '1') notFound();
  return <SiteShell>{children}</SiteShell>;
}
