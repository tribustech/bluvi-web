import 'server-only';
import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { requireViewer } from '@/lib/server/require-viewer';
import type { Viewer } from '@/lib/server/viewer';

/*
 * The server half of every M7 operator page (/operator and below). Contract for the M7 batches:
 *
 *   export const metadata = operatorMetadata('Rezervări');            // noindex, nofollow
 *   export default function Page({ params, searchParams }) {
 *     return (
 *       <OperatorGate next={nextOf(params, searchParams)} fallback={<MySkeleton />}>
 *         {(viewer) => <MyScreen lakeId={…} />}
 *       </OperatorGate>
 *     );
 *   }
 *
 * - Signed out with no cookie: proxy.ts answers 307 → /intra?next=<path+query> before rendering.
 * - A dead cookie: requireViewer redirects to /intra?next=<next> (`next` = the page's own path WITH
 *   its query, built with lib/routes.ts — a promise is fine, it is awaited inside the boundary).
 * - Session unknown (CMS down / slow): SessionUnknownError → the route's error.tsx (re-export
 *   OperatorRouteError from ./OperatorErrorState).
 * - Ownership is NOT checked here (operator.b.role-gating): the CMS owner-gates every operator
 *   endpoint, and a refusal lands in the screen's OperatorErrorState («Nu ai acces»).
 * Everything operator is per owner: read in the browser through /api/cms, never cached, never indexed.
 */

/** noindex metadata of an operator page (per owner, never in a search engine). */
export function operatorMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: false } };
}

/** The session gate (Cache Components: request-time, so always inside a Suspense boundary). */
export async function requireOperatorViewer(next: string | Promise<string>): Promise<Viewer> {
  return requireViewer(await next);
}

/** requireOperatorViewer awaited inside its own Suspense boundary; `fallback` is the page's skeleton. */
export function OperatorGate({
  next,
  fallback,
  children,
}: {
  next: string | Promise<string>;
  fallback: ReactNode;
  children: (viewer: Viewer) => ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      <Gated next={next}>{children}</Gated>
    </Suspense>
  );
}

async function Gated({ next, children }: { next: string | Promise<string>; children: (viewer: Viewer) => ReactNode }) {
  const viewer = await requireOperatorViewer(next);
  return <>{children(viewer)}</>;
}
