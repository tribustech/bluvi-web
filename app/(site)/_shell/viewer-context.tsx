'use client';

import { createContext, use, type ReactNode } from 'react';
import type { Viewer } from '@/lib/server/viewer';

/**
 * What the shell chrome knows about the session: the user, null (signed out), or unknown — the
 * read did not answer in time (or, once lib/server/viewer.ts reports it, failed for a reason other
 * than a dead session). Unknown is never shown as «Intră».
 */
export type ShellViewer = Viewer | null | { status: 'unknown' };

export const isUnknownViewer = (v: ShellViewer | undefined): v is { status: 'unknown' } =>
  v !== null && v !== undefined && 'status' in v && v.status === 'unknown';

type Value = { viewer: Promise<Viewer | null>; shell: Promise<ShellViewer>; late: Promise<ShellViewer> };
const ViewerContext = createContext<Value | null>(null);

/**
 * Holds the server's un-awaited `getViewer()` promise so any client component under the shell can
 * read the signed-in user without prop drilling. Starting the read in the layout lets it stream in
 * parallel with the page instead of blocking it. For the top bar only: `shell` is the read bounded
 * by a short timeout, `late` the same read under a longer one that never rejects (a failure or a
 * hang is «unknown», so the stream always closes) — the bar
 * upgrades itself from it when `shell` timed out first. Pages keep waiting for the real answer.
 */
export function ViewerProvider({
  viewer,
  shell,
  late,
  children,
}: {
  viewer: Promise<Viewer | null>;
  shell?: Promise<ShellViewer>;
  late?: Promise<ShellViewer>;
  children: ReactNode;
}) {
  return <ViewerContext value={{ viewer, shell: shell ?? viewer, late: late ?? viewer }}>{children}</ViewerContext>;
}

/** The signed-in user or null. Suspends until the session read resolves: call it behind <Suspense>. */
export function useViewer(): Viewer | null {
  const value = use(ViewerContext);
  if (!value) throw new Error('useViewer must be used inside <ViewerProvider>');
  return use(value.viewer);
}

/** The shell's view of the session (may be unknown). Suspends like useViewer, but for a bounded time. */
export function useShellViewer(): ShellViewer {
  const value = use(ViewerContext);
  if (!value) throw new Error('useShellViewer must be used inside <ViewerProvider>');
  return use(value.shell);
}

/** The session read without the shell's timeout (never rejects; a failure is unknown). */
export function useLateShellViewer(): ShellViewer {
  const value = use(ViewerContext);
  if (!value) throw new Error('useLateShellViewer must be used inside <ViewerProvider>');
  return use(value.late);
}
