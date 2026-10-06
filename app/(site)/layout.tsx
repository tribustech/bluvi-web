import type { ReactNode } from 'react';
import { SiteShell } from './_shell/SiteShell';

/** Every product page renders inside the one app shell (./_shell/SiteShell.tsx). */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
