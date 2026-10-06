'use client';

import { Suspense, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { ViewerProvider, type ViewerState } from './viewer-context';

/** Settled sessions, created once (React's `use` needs a stable promise). */
const SIGNED_OUT: Promise<ViewerState> = Promise.resolve(null);
const UNKNOWN: Promise<ViewerState> = Promise.resolve({ status: 'unknown' });

/**
 * Which query-string values force the shell's session (template demos only): `?<param>=<value>`
 * in `out` gives the chrome a signed-out session, in `unknown` an unknown one; any other value
 * keeps the real session.
 */
export type ForcedSessionRule = { param: string; out?: readonly string[]; unknown?: readonly string[] };

/**
 * The chrome under a forced session (SiteShell `forced`). The query string is read behind its own
 * boundary, so the chrome never waits on it: until it is known the real session is used.
 */
export function ForcedSession({ rule, children }: { rule: ForcedSessionRule; children: ReactNode }) {
  return (
    <Suspense fallback={children}>
      <Forced rule={rule}>{children}</Forced>
    </Suspense>
  );
}

function Forced({ rule, children }: { rule: ForcedSessionRule; children: ReactNode }) {
  const value = useSearchParams()?.get(rule.param) ?? '';
  const forced = rule.out?.includes(value) ? SIGNED_OUT : rule.unknown?.includes(value) ? UNKNOWN : null;
  if (!forced) return children;
  return <ViewerProvider viewer={forced}>{children}</ViewerProvider>;
}
