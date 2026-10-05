import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { getOwnedLakes } from '@/core/booking';
import { getLakeOperatorStats, type LakeOperatorStats } from '@/core/lakes';
import { isApiError } from '@/core/transport';
import {
  DashboardEmpty,
  DashboardError,
  DashboardHeader,
  DashboardPage,
  DashboardRefresh,
  DashboardSignedOut,
  DashboardSkeleton,
  SkeletonCaption,
} from '@/components/templates/T5';
import { ButtonLink } from '@/components/ui/Button';
import { getSessionToken } from '@/lib/server/session';
import { SetBreadcrumb } from '../../../(site)/_shell/SiteHeader';
import { createServerTransport } from '@/lib/server/transport';
import { BASE_LAKE, baseFixture, demoNow } from './_demo/fixtures';
import { lakeTrail, operatorLinks, PANEL_TITLE } from './_demo/links';
import { OperatorDashboard, type Simulation } from './_demo/OperatorDashboard';
import { DEMO_PATH, parseState, StateSwitcher } from './_demo/StateSwitcher';
import { CMS_TIMEOUT_MS, withTimeout } from './_demo/timeout';
import { todayCaption } from './_demo/format';

export const metadata: Metadata = { title: 'T5 · Dashboard', robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The ?state= values drawn by OperatorDashboard over fixtures (the rest are page states). */
const SIMULATED: string[] = ['busy', 'legacy', 'empty', 'one-pending', 'many-pending', 'refresh-failed', 'trend-loading', 'trend-failed', 'detail'];

/**
 * T5 «Dashboard» demo — the lake operator panel (fish app/(app)/operator/[lakeId]/index.tsx,
 * docs/parity/areas/operator.yml «operator.panou») composed from components/templates/T5, with the
 * QA account's real lake from the local CMS through core/. `?state=` shows every state.
 * Dev only: 404 in production builds.
 */
export default function T5DemoPage({ searchParams }: { searchParams: SearchParams }) {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_KIT !== '1') notFound();
  return (
    <>
      {/* The strip streams on its own (same markup, nothing selected, as the fallback), so the
          skeleton below never moves when it lands. */}
      <Suspense fallback={<StateSwitcher current={null} />}>
        <Switcher searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<Loading caption={<SkeletonCaption />} />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const BACK = { href: '/', label: 'Înapoi' };

/**
 * Every page state draws the same header box — h1, the «Azi, …» caption, the phone's back chip —
 * under the same breadcrumb (`lakeTrail`, from 768, the band of the real /operator/<id> page). Only
 * the h1 text changes when the body lands: «Panoul bălții» while no lake is known (loading, signed
 * out, refusals, errors), the lake's name once it is.
 */
function Frame({ title = PANEL_TITLE, caption, actions, children }: { title?: string; caption: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <>
      <SetBreadcrumb trail={lakeTrail(title)} />
      <DashboardPage header={<DashboardHeader title={title} caption={caption} back={BACK} actions={actions} />}>{children}</DashboardPage>
    </>
  );
}

/**
 * Loading: the real header with the fallback title (fish keeps the panel header while loading,
 * operator.panou.c1 / c3) — the page has its h1, its way back and its real refresh control (the
 * router.refresh path needs no data) from the first paint, and only the title text changes when
 * the data lands — over the body's skeleton.
 */
function Loading({ caption }: { caption: ReactNode }) {
  return (
    <Frame caption={caption} actions={<DashboardRefresh />}>
      <DashboardSkeleton header={false} />
    </Frame>
  );
}

/** A refusal has nothing to retry: the card offers the way to the lakes this account runs. */
const toOwnLakes = (
  <ButtonLink href={operatorLinks.picker} variant="secondary">
    Vezi bălțile tale
  </ButtonLink>
);

/** The request's «now»: every figure on the panel is anchored to it (one value per render). */
async function requestTime(): Promise<number> {
  await connection();
  return Date.now();
}

async function Switcher({ searchParams }: { searchParams: SearchParams }) {
  return <StateSwitcher current={parseState((await searchParams).state)} />;
}

const signedOut = (caption: ReactNode) => (
  <Frame caption={caption}>
    <DashboardSignedOut next={DEMO_PATH} description="Panoul arată rezervările, încasările și ocuparea bălților pe care le administrezi." />
  </Frame>
);

/**
 * A failed first read, by cause: a dead session (401) → the sign-in card; no access (403 / 404) →
 * an access error with nothing to retry; the network or the CMS (0, 5xx, timeout) → the retry.
 */
function loadFailure(e: unknown, caption: ReactNode, title?: string) {
  if (isApiError(e) && e.status === 401) return signedOut(caption);
  if (isApiError(e) && (e.status === 403 || e.status === 404)) {
    return (
      <Frame title={title} caption={caption}>
        <DashboardError title="Nu ai acces la panoul acestei bălți." description="Panoul e vizibil doar administratorilor bălții." action={toOwnLakes} />
      </Frame>
    );
  }
  return (
    <Frame title={title} caption={caption}>
      <DashboardError retry />
    </Frame>
  );
}

async function Body({ searchParams }: { searchParams: SearchParams }) {
  const state = parseState((await searchParams).state);
  const token = await getSessionToken();
  const requestNow = await requestTime();
  // The simulated states run at a fixed hour of today, so their rows are today's and stable.
  const simulate = SIMULATED.includes(state) ? (state as Simulation) : null;
  const simulated = simulate !== null && simulate !== 'empty';
  const nowMs = simulated ? demoNow(requestNow) : requestNow;
  // The header outside the panel (error states); the panel recomputes its own from its clock.
  const caption = todayCaption(nowMs);

  if (state === 'loading') return <Loading caption={caption} />;

  if (state === 'signed-out' || !token) return signedOut(caption);

  // One deadline for the whole render: the reads are serial, so a per-request timeout would let a
  // hanging CMS hold the skeleton for 8 s per read instead of 8 s in all.
  const t = withTimeout(createServerTransport(), AbortSignal.timeout(CMS_TIMEOUT_MS));

  if (state === 'slow') {
    // A CMS that never answers: the skeleton (the Suspense fallback) until the 8 s deadline, then
    // the error card — a hanging CMS lands in an error, never an endless skeleton.
    await new Promise((resolve) => setTimeout(resolve, CMS_TIMEOUT_MS));
    return (
      <Frame caption={caption}>
        <DashboardError retry />
      </Frame>
    );
  }

  if (state === 'error') {
    return (
      <Frame caption={caption}>
        <DashboardError retry />
      </Frame>
    );
  }

  const panel = (lake: { documentId: string; name: string }, stats: LakeOperatorStats) => (
    <OperatorDashboard lakeId={lake.documentId} lakeName={lake.name} initial={stats} nowMs={nowMs} fetchedAt={requestNow} simulate={simulate} back={BACK} />
  );

  // Serial by necessity: the stats read needs the lake id that owned-lakes returns.
  let lakes;
  try {
    lakes = await getOwnedLakes(t);
  } catch (e) {
    // A simulated state is a fixture: a slow or failing CMS must not replace it with an error.
    if (simulated) return panel(BASE_LAKE, baseFixture());
    return loadFailure(e, caption);
  }

  if (simulated && lakes.length === 0) return panel(BASE_LAKE, baseFixture());

  if (state === 'no-lake' || lakes.length === 0) {
    return (
      <Frame caption={caption}>
        <DashboardEmpty
          title="Nu administrezi nicio baltă."
          description="Când devii administratorul unei bălți, panoul ei apare aici."
          action={
            <ButtonLink href="/balti" variant="secondary">
              Vezi bălțile
            </ButtonLink>
          }
        />
      </Frame>
    );
  }

  const lake = lakes[0];

  if (state === 'not-owner') {
    // A real request for a lake this account does not operate: the CMS refuses it (403 / 404). Any
    // other failure (network, 5xx, the deadline) is not a refusal: it gets the retry card.
    try {
      await getLakeOperatorStats(t, 'balta-altcuiva', 'week');
    } catch (e) {
      if (isApiError(e) && e.status === 404) {
        return (
          <Frame caption={caption}>
            <DashboardError title="Balta nu există sau nu o administrezi." description="Panoul e vizibil doar administratorilor bălții." action={toOwnLakes} />
          </Frame>
        );
      }
      return loadFailure(e, caption);
    }
    // The CMS answered: this account does run it after all.
  }

  let stats: LakeOperatorStats;
  try {
    stats = await getLakeOperatorStats(t, lake.documentId, 'week');
  } catch (e) {
    if (simulated) return panel(lake, baseFixture());
    return loadFailure(e, caption, lake.name);
  }

  return panel(lake, stats);
}
