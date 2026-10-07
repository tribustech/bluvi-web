/*
 * global.b.session-expired / account.b.session-expired (fish services/api/api.ts:55-102 +
 * AuthContext.tsx:285-307): the first SESSION_DEAD error forces one sign-out with the error toast;
 * the rest of the burst (60 s) is swallowed. A successful sign-in re-arms the guard at once.
 *
 * Module state on purpose: the query client is a browser singleton, the guard must be too. The
 * toast host (app/(site)/_shell/Toast.tsx) lives under the root providers, so the message is
 * handed over through a one-slot mailbox it drains on mount.
 */

export const SESSION_EXPIRED_MESSAGE = 'Sesiunea ta a expirat. Te rugăm să te autentifici din nou.';
export const SESSION_GUARD_MS = 60_000;

let firedAt: number | null = null;
let listener: ((text: string) => void) | null = null;
let pending: string | null = null;

/** True for the first dead session of a burst (the caller signs out); false for the rest. */
export function claimSessionDead(now = Date.now()): boolean {
  if (firedAt !== null && now - firedAt < SESSION_GUARD_MS) return false;
  firedAt = now;
  return true;
}

/** Called after a successful sign-in: the next dead session is reported again. */
export function rearmSessionGuard(): void {
  firedAt = null;
}

export function announceSessionExpired(): void {
  if (listener) listener(SESSION_EXPIRED_MESSAGE);
  else pending = SESSION_EXPIRED_MESSAGE;
}

/** The toast host subscribes; a message announced before it mounted is delivered at once. */
export function onSessionExpired(show: (text: string) => void): () => void {
  listener = show;
  if (pending) {
    show(pending);
    pending = null;
  }
  return () => {
    if (listener === show) listener = null;
  };
}
