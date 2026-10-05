import type { ReactNode } from 'react';
import SiteLayout from '@/app/(site)/layout';

/** The T2 demo renders inside the real shell (top bar), so its heights and edges are the page's. */
export default function T2DemoLayout({ children }: { children: ReactNode }) {
  return <SiteLayout>{children}</SiteLayout>;
}
