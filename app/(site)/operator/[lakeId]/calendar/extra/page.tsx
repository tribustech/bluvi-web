import { notFound, redirect } from 'next/navigation';
import { getOwnedLakes } from '@/core/booking';
import { isApiError } from '@/core/transport';
import { routes } from '@/lib/routes';
import type { SearchParams } from '@/lib/search-params';
import { createServerTransport } from '@/lib/server/transport';
import type { Viewer } from '@/lib/server/viewer';
import { loadLake } from '@/app/(site)/balti/[id]/_components/load';
import { readFlowParams } from '@/app/(site)/balti/[id]/rezerva/_flow/params';
import { OperatorGate, operatorMetadata } from '../../../_shared/gate';
import { WalkInExtrasForbidden, WalkInExtrasScreen, WalkInExtrasSkeleton } from './WalkInExtrasScreen';

/*
 * /operator/[lakeId]/calendar/extra — operator.calendar-extra (T4, step 2 of the walk-in): what the
 * operator adds to the tour sold at the gate (a cabin). fish app/(app)/operator/[lakeId]/walk-in/extras.tsx,
 * which is the angler's extras step in the walk-in flow — so is this page: the angler's ExtrasScreen
 * (booking.rezerva-extra) mounted with the walk-in FlowConfig (calendar/_walkin/flowConfig.ts):
 * the quote is a walk-in (c2), Continuă → …/calendar/confirmare (c3), Back → the calendar with the
 * selection kept, the extras cleared (c4).
 *
 * c1: a URL without a selection never renders — the server sends it to the bare calendar; a stand
 * the lake no longer has, a lake that stopped taking bookings or a tour the stand has nothing to add
 * to is judged in the browser against the LIVE availability (the angler's extrasRedirect, walk-in paths).
 *
 * Signed in only (OperatorGate: /intra?next=<this page with its selection and extras>). Not indexed.
 * Owner only (operator.b.role-gating): this step reads nothing owner-gated (the availability and the
 * quote are public — the CMS takes `walkIn: true` from anyone), so no 403 would ever come back from
 * the CMS; the page checks the owned lakes itself and shows «Nu ai acces» in the step's frame.
 * The lake's name and checkout buffer come from the cached public lake (the calendar's read); a lake
 * the public endpoint does not know keeps the owned-lakes name the gate already read.
 */

type Props = { params: Promise<{ lakeId: string }>; searchParams: Promise<SearchParams> };

export const metadata = operatorMetadata('Extra · Calendar');

async function nextOf({ params, searchParams }: Props): Promise<string> {
  const { lakeId } = await params;
  const { selection, extras } = readFlowParams(await searchParams);
  return selection ? routes.operatorCalendarExtras(lakeId, { ...selection, extras }) : routes.operatorCalendar(lakeId);
}

export default function OperatorCalendarExtrasPage(props: Props) {
  return (
    <OperatorGate next={nextOf(props)} fallback={<WalkInExtrasSkeleton />}>
      {(viewer) => <Extras params={props.params} searchParams={props.searchParams} viewer={viewer} />}
    </OperatorGate>
  );
}

/**
 * Whether the viewer owns the lake. The viewer's list first; it is empty both for a non-owner and
 * when its read failed (readOwnedLakes swallows a CMS hiccup), so a miss is confirmed by a fresh,
 * uncached /feed/owned-lakes read: a 401/403 there means no access, any other failure throws into
 * error.tsx («Serverul nu răspunde») — never «Nu ai acces» for an owner the CMS could not answer.
 */
async function ownsLake(viewer: Viewer, lakeId: string): Promise<boolean> {
  if (viewer.ownedLakes.some((l) => l.documentId === lakeId)) return true;
  try {
    const lakes = await getOwnedLakes(createServerTransport());
    return lakes.some((l) => l.documentId === lakeId);
  } catch (e) {
    if (isApiError(e) && (e.status === 401 || e.status === 403)) return false;
    throw e;
  }
}

async function Extras({ params, searchParams, viewer }: Props & { viewer: Viewer }) {
  const { lakeId } = await params;
  if (!lakeId) notFound();
  // c1: nothing to add to without a tour (fish `<Redirect href={basePath} />`).
  if (!readFlowParams(await searchParams).selection) redirect(routes.operatorCalendar(lakeId));
  const [owns, load] = await Promise.all([ownsLake(viewer, lakeId), loadLake(lakeId)]);
  const lake = load.kind === 'ok' ? load.lake : null;
  if (!owns) return <WalkInExtrasForbidden lakeId={lakeId} lakeName={lake?.name ?? ''} next={await nextOf({ params, searchParams })} />;
  return (
    <WalkInExtrasScreen
      lake={{
        documentId: lakeId,
        name: lake?.name || viewer.ownedLakes.find((l) => l.documentId === lakeId)?.name || '',
        checkoutBufferMinutes: lake?.checkoutBufferMinutes ?? null,
      }}
    />
  );
}
