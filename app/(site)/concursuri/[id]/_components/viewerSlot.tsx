'use client';

import { Suspense, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { buttonClass } from '@/components/ui/Button';
import { isUnknownViewer, useViewerState } from '../../../_shell/viewer-context';
import type { PageViewer } from './Follow';

/** The viewer as a per-viewer slot sees it: the page's viewer, or what the server streamed. */
export type SlotViewer = PageViewer | 'unknown';

/**
 * A per-viewer slot (the header's actions, the phone bar's «Înscrie-te» and Chat). The page's viewer
 * (`viewer`) arrives after hydration (CompetitionScreen ViewerIsland); until then the slot reads the
 * shell's session itself, behind its own small Suspense — the same streamed read as the top bar — so
 * a request without a session cookie gets its signed-out action in the HTML, and an unknown session
 * `'unknown'`. A signed-in session stays pending (`undefined`, the fallback) until the page has the
 * viewer: its overlay and statute decide the action. Pending is never shown as «signed out».
 */
export function ViewerSlot({ viewer, fallback, children }: { viewer: PageViewer; fallback: ReactNode; children: (v: SlotViewer) => ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <StreamedViewer viewer={viewer}>{children}</StreamedViewer>
    </Suspense>
  );
}

function StreamedViewer({ viewer, children }: { viewer: PageViewer; children: (v: SlotViewer) => ReactNode }) {
  const session = useViewerState();
  const v: SlotViewer = viewer !== undefined ? viewer : session === null ? null : isUnknownViewer(session) ? 'unknown' : undefined;
  return children(v);
}

/**
 * «Înscrie-te» / «Modifică înscrierea» when fish's rules say no (core registrationAction): the
 * disabled look, but `aria-disabled` instead of the native `disabled`, so it stays focusable and a
 * keyboard or screen-reader user reaches it and hears why (its description: the visible reason line).
 */
export function DisabledRegisterButton({ label, describedBy, block = false }: { label: string; describedBy?: string; block?: boolean }) {
  return (
    <button
      type="button"
      aria-disabled="true"
      aria-describedby={describedBy}
      onClick={e => e.preventDefault()}
      className={buttonClass({ disabled: true, block })}
    >
      <span aria-hidden className="flex size-5 items-center justify-center [&>svg]:size-5">
        <ClipboardDocumentListIcon />
      </span>
      {label}
    </button>
  );
}

/**
 * What «Înscrie-te» is for this viewer (fish RankingActionBar notStarted + disabledInscrieTe, which
 * does not depend on the session: a full competition or a passed deadline is closed for a guest too):
 *  - `pending`: the session is not known yet — a bone, never the guest's sign-in link;
 *  - `unknown`: the session could not be read (a cookie whose read failed) — closed, with the reason
 *    and a way to check again (SessionRecheck), never a bone that never resolves;
 *  - `signIn`: a guest, registration open — sign in first;
 *  - `offered`: signed in, allowed — it continues in the Bluvi app;
 *  - `disabled`: closed by the rules, with fish's reason.
 */
export type RegisterState =
  | { kind: 'pending' }
  | { kind: 'unknown'; label: string; reason: string }
  | { kind: 'signIn'; label: string }
  | { kind: 'offered'; label: string }
  | { kind: 'disabled'; label: string; reason: string | null };

export function registerState(
  v: SlotViewer,
  registration: { label: string; disabled: boolean; reason: string | null } | null | undefined,
  fallbackLabel: string,
): RegisterState {
  if (v === undefined) return { kind: 'pending' };
  const label = registration?.label ?? fallbackLabel;
  if (v === 'unknown') return { kind: 'unknown', label, reason: SESSION_UNKNOWN_REASON };
  if (registration?.disabled) return { kind: 'disabled', label, reason: registration.reason };
  if (v === null) return { kind: 'signIn', label };
  return registration ? { kind: 'offered', label } : { kind: 'disabled', label, reason: null };
}

/** Why «Înscrie-te» is closed while the session could not be read. */
export const SESSION_UNKNOWN_REASON = 'Nu am putut verifica sesiunea.';

/**
 * «Reîncearcă» for an unread session, as a text button inside a reason line: re-reads the page
 * (router.refresh, in a transition — busy and aria-disabled while it runs).
 */
export function SessionRecheck() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      onClick={() => {
        if (!pending) start(() => router.refresh());
      }}
      className="inline-flex min-h-6 cursor-pointer items-center t-label text-accent-ink underline underline-offset-2 aria-disabled:cursor-progress"
    >
      {pending ? 'Se verifică…' : 'Reîncearcă'}
    </button>
  );
}
