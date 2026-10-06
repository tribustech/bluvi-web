import type { ReactNode } from 'react';
import { SiteShell } from '@/app/(site)/_shell/SiteShell';

/** The T2 demo renders inside THE app shell (top bar), so its heights and edges are the page's. */
export default function T2DemoLayout({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
