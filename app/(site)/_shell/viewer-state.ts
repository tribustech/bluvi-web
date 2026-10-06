import type { ShellUser, UnknownSession, ViewerState } from './session';

/*
 * The session's three answers (./session.ts), as plain helpers usable on the server and in the
 * browser (viewer-context.tsx is a client module: its exports are client references on the server).
 */

export const isUnknownViewer = (v: ViewerState | undefined): v is UnknownSession =>
  v !== null && v !== undefined && 'status' in v && v.status === 'unknown';

/** The signed-in user, or null for signed out AND unknown — only for code that has handled unknown. */
export const userOf = (v: ViewerState | undefined): ShellUser | null => (v && !isUnknownViewer(v) ? v : null);
