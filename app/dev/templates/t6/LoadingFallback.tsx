'use client';

import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  FlowActions,
  FlowAsideSkeleton,
  FlowFieldSkeleton,
  FlowHeaderSkeleton,
  FlowLayout,
  FlowLoadingStatus,
  FlowNoticeSkeleton,
  FlowSkeleton,
  FlowSubjectSkeleton,
} from '@/components/templates/T6';
import { Button } from '@/components/ui/Button';
import { READ_ONLY_TITLE, isStepTwo } from './states';

/*
 * The demo's loading states, in three layers:
 * 1. The static shell (`LoadingNeutral`): rendered before the URL is known (useSearchParams
 *    suspends while the shell is built), so it names no step — a grey title bar, no h1, no
 *    step-specific body — and never shows «Alege standul» on a step-2 URL.
 * 2. On the client (`LoadingFallback`), the URL picks step 1's or step 2's skeleton. Step 2's
 *    title waits for the data (an open or a read-only step is titled differently), so it is a
 *    grey bar too: no h1 ever swaps text.
 * 3. Once the scale is read the page knows the viewer's access: step 2's header, notice and subject
 *    are real and only the step's own reads wait (page.tsx), in the shape of what will land — the
 *    form and its action bar only when the viewer weighs.
 * Real routes (/concursuri/[id]/cantar, …/cantar/[standId]) give each step its own loading.tsx,
 * so the path segment picks the skeleton on the server and there is no client guess.
 */

export function LoadingFallback() {
  const sp = useSearchParams();
  return isStepTwo(sp.get('state'), sp.get('stand')) ? <AddCatchSkeleton /> : <LoadingFlow />;
}

/** A grey text bar with the kit's one shimmer (as FlowStates and T4's skeleton). */
const BAR = 'inline-block max-w-full rounded-full bg-soft-fill animate-shimmer align-middle';
/** The stat-size number's placeholder (t-num-40 line): control radius, not a pill. */
const STAT_BAR = 'inline-block h-9 w-40 max-w-full rounded-control bg-soft-fill animate-shimmer align-middle';

/**
 * Loading for a viewer with no session (page.tsx knows from the cookie): the sign-in gate's shape —
 * the narrow, bare frame and a T4Gate-sized card (56px disc, title2, two body lines, the action) —
 * so a guest never sees the form or the stand grid flash before the gate. Titled like the gate's
 * header: «Alege standul» on step 1, the read-only title on a stand URL.
 */
export function GateSkeleton({ stepTwo = false }: { stepTwo?: boolean }) {
  return (
    <FlowLayout
      header={<FlowHeaderSkeleton id="t6-title" title={stepTwo ? READ_ONLY_TITLE : 'Alege standul'} />}
      labelledBy="t6-title"
      variant="bare"
      narrow
      busy
    >
      <FlowLoadingStatus label="Se încarcă cântarul…" />
      <div
        aria-hidden
        className="flex flex-col items-center gap-3 rounded-card bg-surface px-5 py-8 text-center shadow-e0 md:px-8 md:py-12 xl:max-w-140"
      >
        <span className="size-14 rounded-full bg-soft-fill animate-shimmer" />
        <span className="t-title2 block w-full">
          <span className={`${BAR} h-4 w-64`} />
        </span>
        <span className="t-body block w-full">
          <span className={`${BAR} h-3 w-72`} />
          <span className="block">
            <span className={`${BAR} h-3 w-48`} />
          </span>
        </span>
        <span className="mt-2 block h-12 w-full rounded-control bg-soft-fill animate-shimmer md:w-36 xl:h-10" />
      </div>
    </FlowLayout>
  );
}

/** Before the URL is read: the flow's frame (header, notice, task card) with nothing step-specific. */
export function LoadingNeutral() {
  return (
    <FlowLayout
      header={<FlowHeaderSkeleton />}
      notice={<FlowNoticeSkeleton phone={{ title: 2, body: 2 }} tablet={{ title: 1, body: 1 }} />}
      busy
    >
      <FlowLoadingStatus label="Se încarcă cântarul…" />
      <div aria-hidden className="flex flex-col gap-3">
        <span className="t-title2 block">
          <span className={`${BAR} h-4 w-40`} />
        </span>
        <span className="block h-32 rounded-card bg-soft-fill animate-shimmer" />
      </div>
    </FlowLayout>
  );
}

/**
 * Step 1 loading: header with its real h1 (the title is known before the data), the notice (a
 * notice is always there once loaded), the compact total below 1280, the search field, the
 * sector grid, and the summary card from 1280 — so nothing moves when the data lands.
 */
export function LoadingFlow() {
  return (
    <FlowLayout
      header={<FlowHeaderSkeleton id="t6-title" title="Alege standul" />}
      notice={<FlowNoticeSkeleton phone={{ title: 2, body: 2 }} tablet={{ title: 1, body: 1 }} />}
      aside={<FlowAsideSkeleton />}
      asideMobile="hidden"
      labelledBy="t6-title"
      busy
    >
      <div aria-hidden className="flex flex-col xl:hidden">
        <span className="t-num-40 block">
          <span className={STAT_BAR} />
        </span>
        <span className="t-caption block">
          <span className={`${BAR} h-2.5 w-56`} />
        </span>
      </div>
      <FlowSkeleton toolbar sections={2} tiles={5} label="Se încarcă standurile…" />
    </FlowLayout>
  );
}

/**
 * Step 2 loading. Before the scale is read (no props) the access is unknown: a header with grey
 * title and meta lines, the notice, the subject card, the open form (a 96px weight field and the
 * stepper beside it, the species chips) and the action bar with its buttons off. After the scale
 * is read (page.tsx) `header`, `notice` and `subject` are the real ones, and `readOnly` drops the
 * form and the bar for a viewer who cannot weigh: the subject and the weighings, as will land.
 */
export function AddCatchSkeleton({
  header,
  notice,
  subject,
  readOnly = false,
}: {
  header?: ReactNode;
  notice?: ReactNode;
  subject?: ReactNode;
  readOnly?: boolean;
} = {}) {
  const status = <FlowLoadingStatus label={readOnly ? 'Se încarcă cântăririle standului…' : 'Se încarcă standul…'} />;
  const subjectBox = subject ?? <FlowSubjectSkeleton people={0} />;
  const layout = {
    header: header ?? <FlowHeaderSkeleton id="t6-title" />,
    // The read-only notice wraps to 2 + 2 lines on a phone; «Previzualizare» fits on one.
    notice: notice ?? <FlowNoticeSkeleton phone={{ title: 1, body: 1 }} tablet={{ title: 1, body: 1 }} />,
    aside: <WeighingsSkeleton />,
    labelledBy: header ? 't6-title' : undefined,
    busy: true,
  };
  if (readOnly) {
    // As the loaded read-only step: no task card, the subject in the step's width, the weighings
    // card after it below 1280 and in the aside from 1280.
    return (
      <FlowLayout {...layout} asideMobile="after" variant="bare">
        {status}
        <div className="xl:max-w-170">{subjectBox}</div>
      </FlowLayout>
    );
  }
  return (
    <FlowLayout
      {...layout}
      actions={
        <FlowActions
          disabled
          primary={
            <Button block disabled>
              Finalizează
            </Button>
          }
          secondary={
            <Button variant="outline" block disabled>
              Adaugă și continuă
            </Button>
          }
        />
      }
    >
      {status}
      {/* AddCatchFlow's step block: the subject spans it (capped at 680 from 1280). */}
      <div className="xl:max-w-170">{subjectBox}</div>
      <div aria-hidden className="flex flex-col gap-5 xl:max-w-170">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-start">
          <FlowFieldSkeleton height="h-24" label="w-20" helper />
          <FlowFieldSkeleton height="h-16 md:h-24" label="w-14" />
        </div>
        {/* A <legend> is not a flex item of its fieldset: only its mb-1.5 sits above the chips. */}
        <div className="flex flex-col">
          <span className="t-label mb-1.5 block">
            <span className={`${BAR} h-3 w-14`} />
          </span>
          <div className="flex flex-wrap gap-2">
            {['w-20', 'w-24', 'w-16'].map((w) => (
              <span key={w} className={`block h-12 rounded-control bg-soft-fill animate-shimmer xl:h-10 ${w}`} />
            ))}
          </div>
        </div>
      </div>
    </FlowLayout>
  );
}

/** The weighings' lines: title, the stat-size total and its caption. */
function WeighingsBody() {
  return (
    <div className="flex flex-col gap-3">
      <p className="t-heading">
        <span className={`${BAR} h-3.5 w-32`} />
      </p>
      <div className="flex flex-col">
        <span className="t-num-40 block">
          <span className={STAT_BAR} />
        </span>
        <span className="t-caption block">
          <span className={`${BAR} h-2.5 w-24`} />
        </span>
      </div>
    </div>
  );
}

/** The stand's weighings card while loading (the aside from 1280). */
function WeighingsSkeleton() {
  return (
    <div aria-hidden className="rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6">
      <WeighingsBody />
    </div>
  );
}
