'use client';

import { createContext, use, type ReactNode } from 'react';
import type { ShellUser, ViewerState } from './session';

export type { ShellUser, ViewerState };
export { isUnknownViewer, userOf } from './viewer-state';

/**
 * What the shell knows about the session (./session.ts): the user, null (signed out), or unknown —
 * a session cookie is there but the read failed or gave no answer in time. Unknown is never shown
 * as «Intră» or as a guest: the bar shows its retry slot, pages a pending / neutral state.
 */
export type ShellViewer = ViewerState;

type Value = { state: Promise<ViewerState>; shell: Promise<ViewerState> };
const ViewerContext = createContext<Value | null>(null);

/**
 * Holds the server's un-awaited session read (./session.ts getViewerState) so any client component
 * under the shell can read it without prop drilling; starting it in the layout lets it stream in
 * parallel with the page instead of blocking it. The read never rejects and is bounded by its own
 * deadline. `shell` is the same read under a shorter bound, for the top bar's first paint only:
 * past it the bar shows the unknown slot and upgrades itself from `state` when that answers — the
 * same promise the page waits for, so the bar and the body can never disagree for long.
 */
export function ViewerProvider({
  viewer,
  shell,
  children,
}: {
  viewer: Promise<ViewerState>;
  shell?: Promise<ViewerState>;
  children: ReactNode;
}) {
  return <ViewerContext value={{ state: viewer, shell: shell ?? viewer }}>{children}</ViewerContext>;
}

/**
 * The session: the user, null (signed out) or unknown. Suspends until the read answers: call it
 * behind <Suspense>. Treat unknown like «still loading» (a skeleton, a neutral state), never as a
 * guest.
 */
export function useViewerState(): ViewerState {
  const value = use(ViewerContext);
  if (!value) throw new Error('useViewerState must be used inside <ViewerProvider>');
  return use(value.state);
}

/** The top bar's first read, bounded by a short timeout (may be unknown while useViewerState is not). */
export function useShellViewer(): ViewerState {
  const value = use(ViewerContext);
  if (!value) throw new Error('useShellViewer must be used inside <ViewerProvider>');
  return use(value.shell);
}
