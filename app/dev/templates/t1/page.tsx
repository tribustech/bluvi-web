import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { getShellSession } from '../../../(site)/_shell/session';
import { placeFromUrl, type ListPlace, type UrlParams } from '../../../(site)/concursuri/_list/place';
import { DemoScreen } from './DemoScreen';
import { initialFor } from './demoInitial';
import { parseDemoState } from './StateSwitcher';

/*
 * /dev/templates/t1 — T1 «Listă cu filtre» as its first user ships it: the PRODUCTION /concursuri
 * screen (CompetitionsScreen), not a copy (owner review 2026-10-06 — the copy had drifted). `?state=`
 * forces a state through the screen's transport (DemoScreen, demoTransport.ts) and picks its place
 * (demoInitial.ts); the list's own URL params (status, scope, q, filters) win when present, as on
 * /concursuri. Dev only: 404 in production builds (layout.tsx). The parity check
 * (tests/e2e/templates-parity.spec.ts) compares this page's landmarks and chips with /concursuri.
 */

export const metadata: Metadata = { title: 'T1 · Listă cu filtre', robots: { index: false } };

type Props = { searchParams: Promise<UrlParams & { state?: string }> };

const DEMO_TABS = ['notStarted', 'started', 'completed'] as const;

const PLACE_KEYS = ['status', 'scope', 'q', 'period', 'format', 'available', 'countyId', 'lakeId'];

export default function T1DemoPage({ searchParams }: Props) {
  return (
    <Suspense fallback={null}>
      <Demo searchParams={searchParams} />
    </Suspense>
  );
}

async function Demo({ searchParams }: Props) {
  await connection();
  const url = await searchParams;
  const state = parseDemoState(url.state);
  const signedOut = state === 'signed-out' || state === 'gate';
  const fromUrl = PLACE_KEYS.some((k) => (url as Record<string, unknown>)[k] != null);
  const base = initialFor(state);
  // The demo keeps `?status=` for its tab (the real list has a page per tab).
  const tab = DEMO_TABS.find((s) => s === url.status);
  const place: ListPlace = fromUrl
    ? placeFromUrl(url, tab ? { tab } : { index: 'notStarted' })
    : { status: base.status, scope: base.scope, search: base.search, filters: base.filters };
  const viewer = signedOut ? null : await getShellSession();
  return (
    <DemoScreen
      key={state}
      state={state}
      initial={place}
      isAuthenticated={viewer !== null}
    />
  );
}
