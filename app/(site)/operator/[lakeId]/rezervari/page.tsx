import { routes } from '@/lib/routes';
import { param, type SearchParams } from '@/lib/search-params';
import { OperatorGate, operatorMetadata } from '../../_shared/gate';
import { FOCUS_PARAM, STATUS_PARAM, SUB_PARAM } from './_list/model';
import { InboxFallback, INBOX_TITLE } from './_list/frame';
import { InboxScreen } from './_list/InboxScreen';

type Props = { params: Promise<{ lakeId: string }>; searchParams: Promise<SearchParams> };

export const metadata = operatorMetadata(INBOX_TITLE);

/**
 * /operator/[lakeId]/rezervari — operator.rezervari «Administrare rezervări» (T1), fish
 * app/(app)/operator/[lakeId]/bookings.tsx. Signed in only (operator.b.role-gating): proxy.ts sends
 * a cookie-less request to /intra?next=<this page with its query>, the gate a dead session; the CMS
 * owner-gates the inbox itself (a refusal is the screen's «Nu ai acces»). Everything here is per
 * owner — read in the browser through /api/cms, never cached, never indexed.
 *
 * ?status= is the shared deep-link vocabulary (operator.b.status-param), ?focus= one booking to bring
 * into view (operator.b.focus-param), ?rezervare= the open booking detail (operator.detaliu-rezervare).
 */
export default function OperatorInboxPage({ params, searchParams }: Props) {
  return (
    <OperatorGate next={nextOf(params, searchParams)} fallback={<InboxFallback />}>
      {() => <Inbox params={params} searchParams={searchParams} />}
    </OperatorGate>
  );
}

/** The sign-in return path: this page with its whole query (tab, focus, the open detail). */
async function nextOf(params: Props['params'], searchParams: Props['searchParams']): Promise<string> {
  const [{ lakeId }, sp] = await Promise.all([params, searchParams]);
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    for (const one of Array.isArray(v) ? v : v === undefined ? [] : [v]) q.append(k, one);
  }
  const s = q.toString();
  return `${routes.operatorBookings(lakeId)}${s ? `?${s}` : ''}`;
}

async function Inbox({ params, searchParams }: Props) {
  const [{ lakeId }, sp] = await Promise.all([params, searchParams]);
  return (
    <InboxScreen
      lakeId={lakeId}
      initialStatus={param(sp, STATUS_PARAM)}
      initialFiltru={param(sp, SUB_PARAM)}
      focus={param(sp, FOCUS_PARAM)}
    />
  );
}
