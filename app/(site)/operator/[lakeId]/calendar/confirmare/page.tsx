import { notFound, redirect } from 'next/navigation';
import { routes } from '@/lib/routes';
import type { SearchParams } from '@/lib/search-params';
import type { Viewer } from '@/lib/server/viewer';
import { loadLake } from '@/app/(site)/balti/[id]/_components/load';
import { readFlowParams } from '@/app/(site)/balti/[id]/rezerva/_flow/params';
import { OperatorGate, operatorMetadata } from '../../../_shared/gate';
import { walkInFacts } from './_walkin/model';
import { WalkInReviewScreen } from './_walkin/WalkInReviewScreen';
import { WalkInReviewSkeleton } from './_walkin/WalkInReviewSkeleton';

/*
 * /operator/[lakeId]/calendar/confirmare — operator.calendar-confirmare (T4, step 3 of the walk-in):
 * the server's price, who the booking is for, «Adaugă rezervarea». fish
 * app/(app)/operator/[lakeId]/walk-in/review.tsx.
 *
 * Guard (c1): a URL without a selection is sent to the calendar before anything renders — a real 307
 * when it resolves before the first byte. A stand the lake no longer has / booking off / a tour no
 * longer free is judged in the browser once the live availability is read (WalkInReviewScreen),
 * still before the step renders. A lake the public read does not know (unpublished, unlisted,
 * pending) is NOT a redirect: like the calendar and the extras step, it keeps the owned-lakes name
 * the gate already read, with no county (the same lake the operator chose a tour on).
 * Signed in only (operator.b.role-gating): proxy.ts / the gate send a signed-out visit to
 * /intra?next=<this step with its selection>. Ownership is the CMS's (the walk-in and the lookup
 * are owner-gated: a refusal is the FORBIDDEN toast). Not indexed.
 *
 * Data: the lake's name, county and checkout buffer from the cached public lake (`/feed/lakes/:id`,
 * as the calendar); availability, quote, search, lookup and reputation are per visit, read in the
 * browser through /api/cms, never cached.
 *
 * Payment (web over fish): a walk-in is ALWAYS cash at the gate — the CMS snapshots it with
 * `paymentMode: 'offline'` whatever the lake's mode (fir-intins-cms booking controller, walkIn). So
 * the summary is built as an offline booking: the «Numerar» chip and «Total · se plătește la fața
 * locului», never the lake's «Avans de plată» / «De plată acum» (which fish still shows), matching
 * the auto-confirm note (c15). The angler's review is untouched.
 */

type Props = { params: Promise<{ lakeId: string }>; searchParams: Promise<SearchParams> };

export const metadata = operatorMetadata('Confirmă rezervarea');

async function nextOf({ params, searchParams }: Props): Promise<string> {
  const { lakeId } = await params;
  const sel = readFlowParams(await searchParams);
  if (!sel.selection) redirect(routes.operatorCalendar(lakeId));
  return routes.operatorCalendarReview(lakeId, { ...sel.selection, extras: sel.extras });
}

export default function OperatorWalkInReviewPage(props: Props) {
  return (
    <OperatorGate next={nextOf(props)} fallback={<WalkInReviewSkeleton />}>
      {(viewer) => <Review params={props.params} viewer={viewer} />}
    </OperatorGate>
  );
}

async function Review({ params, viewer }: { params: Props['params']; viewer: Viewer }) {
  const { lakeId } = await params;
  if (!lakeId) notFound();
  const load = await loadLake(lakeId);
  const lake = load.kind === 'ok' ? load.lake : null;
  const owned = viewer.ownedLakes.find((l) => l.documentId === lakeId)?.name;
  return <WalkInReviewScreen lake={walkInFacts(lakeId, lake, owned)} />;
}
