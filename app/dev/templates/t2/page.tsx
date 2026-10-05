import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { SetBreadcrumb } from '@/app/(site)/_shell/SiteHeader';
import { T2Viewport } from '@/components/templates/T2';
import { loadDemoLakes, type DemoLakesResult } from './data';
import { LakesMapDemo } from './LakesMapDemo';
import { parseDemoState, type DemoState } from './states';
import { StateSwitcher } from './StateSwitcher';

export const metadata: Metadata = {
  title: 'T2 · Listă cu hartă',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * T2 «Listă cu hartă» demo — fish «Hartă bălți» on real local CMS data, every state behind
 * ?state=… (see states.ts). Dev only: 404 in production builds, like /dev/kit.
 */
export default function T2DemoPage({ searchParams }: Props) {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_KIT !== '1') notFound();
  return (
    // The state strip and the template share the screen under the shell.
    <T2Viewport>
      {/*
        The fallback has no map instance (staticMap: the map's chrome, disabled, no MapLibre): the
        real map is built once, when the data lands. ?state=loading renders the same tree, so the
        state reviewers look at is the real first paint.
      */}
      <Suspense fallback={<Demo urlState={null} state="loading" data={NO_DATA} staticMap />}>
        <Loaded searchParams={searchParams} />
      </Suspense>
    </T2Viewport>
  );
}

const NO_DATA: DemoLakesResult = { lakes: [], bookingKnown: true, cardsKnown: true };

async function Loaded({ searchParams }: Props) {
  const state = parseDemoState((await searchParams).state);
  if (state === 'loading') return <Demo urlState={state} state={state} data={NO_DATA} staticMap />;
  if (state === 'error') return <Demo urlState={state} state={state} data={NO_DATA} />;
  let data: DemoLakesResult;
  try {
    data = await loadDemoLakes();
  } catch (e) {
    console.error('[dev/templates/t2] loading lakes failed', e);
    return <Demo urlState={state} state="error" data={NO_DATA} />;
  }
  if (state === 'partial') {
    // What a failed booking read and a failed card read leave: pins without booking, species, facilities.
    data = {
      lakes: data.lakes.map((l) => ({ ...l, bookable: false, species: [], facilities: [] })),
      bookingKnown: false,
      cardsKnown: false,
    };
  }
  return <Demo urlState={state} state={state} data={data} />;
}

/**
 * `urlState` is what the switcher marks and what keys the demo (a new ?state= starts it fresh);
 * `state` is what renders (the CMS can turn any of them into «error»).
 */
function Demo({
  urlState,
  state,
  data,
  staticMap = false,
}: {
  urlState: DemoState | null;
  state: DemoState;
  data: DemoLakesResult;
  staticMap?: boolean;
}) {
  return (
    <>
      <SetBreadcrumb trail={[{ label: 'Bălți', href: '/balti' }, { label: 'Hartă (șablon T2)' }]} />
      <StateSwitcher current={urlState} />
      <LakesMapDemo
        key={urlState ?? 'pending'}
        state={state}
        forced={urlState === state}
        lakes={data.lakes}
        bookingKnown={data.bookingKnown}
        cardsKnown={data.cardsKnown}
        staticMap={staticMap}
      />
    </>
  );
}
