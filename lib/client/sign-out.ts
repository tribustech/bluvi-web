'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useSyncExternalStore, useTransition } from 'react';
import { useSiteToast } from '@/app/(site)/_shell/Toast';
import { startNewSession } from '@/lib/observability/report';
import { claimSessionDead, signOutFirebaseQuietly } from './session-expired';

/*
 * account.b.sign-out — fish contexts/auth/AuthContext.tsx:257-296, the ONE sign-out of the site:
 * the top bar's «Ieși din cont» (avatar menu, phone ☰ panel) and Setări's «Deconectare» / «Șterge
 * contul» all run it.
 *
 * fish's steps and their web counterparts:
 *  - unsubscribe the push token, Google/Facebook SDK sign-out, chat outbox, live-partidă store,
 *    recently viewed lakes — native-only state, nothing on the web;
 *  - clear the session → POST /api/auth/logout (drops the httpOnly cookie; the JWT is stateless);
 *  - sign out of Firebase → signOutFirebaseQuietly (never throws);
 *  - cancel and clear the whole query cache → qc.cancelQueries() + qc.clear();
 *  - go to sign-in → `to` (router.replace) and router.refresh() so the shared layout (the top bar's
 *    Viewer, read on the server) re-renders signed out; without `to` the page re-renders in place
 *    (a public page stays, an account page's gate sends to /intra).
 * If the logout POST fails, fish still clears its session (it lives on the device) and toasts «A
 * aparut o problema…». The web cannot drop the httpOnly cookie without the server: the visitor is
 * still signed in. So only a confirmed logout signs out of Firebase, clears the cache and navigates;
 * a failed one leaves everything as it was (cache, Firebase, page) and toasts «A apărut o problemă…»
 * — the caller's confirm stays usable for a retry.
 *
 * The 401s that follow are expected, not an expired session: the burst guard is claimed
 * (claimSessionDead), so a query that refetches without the cookie before the signed-out page
 * commits never triggers the «Sesiunea ta a expirat» flow. A sign-in re-arms it (SignIn.tsx).
 */

/** fish's toast when a sign-out step fails (fish's copy, with the diacritics it misses). */
export const SIGN_OUT_FAILED = 'A apărut o problemă. Te rugăm să încerci mai târziu.';

// One sign-out at a time for the whole page (the top bar and Setări share it): module state, read
// by every caller through useSyncExternalStore.
let running = false;
const listeners = new Set<() => void>();
function setRunning(next: boolean) {
  if (running === next) return;
  running = next;
  for (const l of listeners) l();
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** True while a sign-out runs (from the press until the signed-out page commits). */
export function useSigningOut(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => running,
    () => false,
  );
}

/** POST /api/auth/logout; false when it failed (the cookie is still there). */
async function dropSessionCookie(): Promise<boolean> {
  try {
    return (await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })).ok;
  } catch {
    return false;
  }
}

/**
 * `signOut()` runs the whole sign-out once (a second call while it runs is ignored); `signingOut`
 * is true for any running sign-out on the page. `to`: where to land (Setări: /intra, as fish's
 * router.replace('/sign-in')); omitted, the current page re-renders signed out. `onDone` runs
 * after the cache is cleared, before the navigation (the top bar arms its focus on «Intră»).
 */
export function useSignOut({ to, onDone }: { to?: string; onDone?: () => void } = {}) {
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useSiteToast();
  const [pending, start] = useTransition();
  const owner = useRef(false);
  const signingOut = useSigningOut();

  // The run ends when its transition (the navigation + refresh) has committed — or when the caller
  // unmounts (Setări is replaced by /intra).
  useEffect(() => {
    if (!pending && owner.current) {
      owner.current = false;
      setRunning(false);
    }
  }, [pending]);
  useEffect(
    () => () => {
      if (owner.current) {
        owner.current = false;
        setRunning(false);
      }
    },
    [],
  );

  const signOut = useCallback(() => {
    if (running) return;
    setRunning(true);
    owner.current = true;
    start(async () => {
      if (!(await dropSessionCookie())) {
        // Still signed in: nothing is cleared, nothing navigates (the run ends with this transition).
        toast(SIGN_OUT_FAILED, 'danger');
        return;
      }
      // From here on a 401 is the sign-out itself, not a dead session (see above).
      claimSessionDead();
      // m8.sentry: later events carry no user and session.state=none; the dedupe re-arms.
      startNewSession('none');
      await signOutFirebaseQuietly();
      void qc.cancelQueries();
      qc.clear();
      onDone?.();
      // After an await the updates are no longer in the transition: wrap them again, so `pending`
      // holds until the signed-out page has committed.
      start(() => {
        if (to) router.replace(to);
        router.refresh();
      });
    });
  }, [qc, router, toast, to, onDone]);

  return { signOut, signingOut: signingOut || pending };
}
