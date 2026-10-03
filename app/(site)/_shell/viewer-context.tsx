'use client';

import { createContext, use, type ReactNode } from 'react';
import type { Viewer } from '@/lib/server/viewer';

const ViewerContext = createContext<Promise<Viewer | null> | null>(null);

/**
 * Holds the server's un-awaited `getViewer()` promise so any client component under the shell can
 * read the signed-in user without prop drilling. Starting the read in the layout lets it stream in
 * parallel with the page instead of blocking it.
 */
export function ViewerProvider({ viewer, children }: { viewer: Promise<Viewer | null>; children: ReactNode }) {
  return <ViewerContext value={viewer}>{children}</ViewerContext>;
}

/** The signed-in user or null. Suspends until the session read resolves: call it behind <Suspense>. */
export function useViewer(): Viewer | null {
  const promise = use(ViewerContext);
  if (!promise) throw new Error('useViewer must be used inside <ViewerProvider>');
  return use(promise);
}
