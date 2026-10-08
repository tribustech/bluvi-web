import { notFound } from 'next/navigation';
import { routes } from '@/lib/routes';
import type { SearchParams } from '@/lib/search-params';
import type { Viewer } from '@/lib/server/viewer';
import { loadLake } from '@/app/(site)/balti/[id]/_components/load';
import { flowQuery, readFlowParams } from '@/app/(site)/balti/[id]/rezerva/_flow/params';
import type { GridLake } from '@/app/(site)/balti/[id]/rezerva/_grid/BookingGridScreen';
import { OperatorGate, operatorMetadata } from '../../_shared/gate';
import { WalkInGridFallback } from './_walkin/WalkInGridFallback';
import { WalkInGridScreen } from './_walkin/WalkInGridScreen';

/*
 * /operator/[lakeId]/calendar — operator.calendar (T4, step 1 of the walk-in; the same frame as
 * booking.rezerva-grila). fish app/(app)/operator/[lakeId]/walk-in/{_layout,index}.tsx.
 *
 * Signed in only (operator.b.role-gating): proxy.ts sends a cookie-less request to /intra, the gate
 * (inside the Suspense boundary, Cache Components) a dead session — both come back here with the
 * selection. Ownership is the CMS's: the lake's bookings list refuses a non-owner (403), which the
 * screen turns into OperatorErrorState. Not indexed.
 *
 * Data: the lake's facts (name, first contact phone, payment mode, deposit, checkout buffer) from the
 * cached public lake (`/feed/lakes/:id`, the angler grid's read); a lake the public endpoint does not
 * know keeps the owned-lakes name the gate already read. Availability, quotes and the bookings list
 * are per visit, read in the browser through /api/cms, never cached.
 */

type Props = { params: Promise<{ lakeId: string }>; searchParams: Promise<SearchParams> };

export const metadata = operatorMetadata('Calendar');

async function nextOf({ params, searchParams }: Props): Promise<string> {
  const { lakeId } = await params;
  const q = flowQuery(readFlowParams(await searchParams).selection);
  return `${routes.operatorCalendar(lakeId)}${q ? `?${q}` : ''}`;
}

export default function OperatorCalendarPage(props: Props) {
  const next = nextOf(props);
  return (
    <OperatorGate next={next} fallback={<WalkInGridFallback />}>
      {(viewer) => <Calendar params={props.params} next={next} viewer={viewer} />}
    </OperatorGate>
  );
}

async function Calendar({ params, next, viewer }: { params: Props['params']; next: Promise<string>; viewer: Viewer }) {
  const { lakeId } = await params;
  if (!lakeId) notFound();
  const load = await loadLake(lakeId);
  const lake = load.kind === 'ok' ? load.lake : null;
  const facts: GridLake = {
    documentId: lakeId,
    name: lake?.name || viewer.ownedLakes.find((l) => l.documentId === lakeId)?.name || '',
    phone: lake?.contact[0]?.phone || null,
    paymentMode: lake?.paymentMode ?? null,
    depositPercent: lake?.depositPercent ?? null,
    checkoutBufferMinutes: lake?.checkoutBufferMinutes ?? null,
  };
  return <WalkInGridScreen lake={facts} next={await next} />;
}
