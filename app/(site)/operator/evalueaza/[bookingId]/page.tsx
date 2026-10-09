import { notFound } from 'next/navigation';
import { routes } from '@/lib/routes';
import type { SearchParams } from '@/lib/search-params';
import { OperatorGate, operatorMetadata } from '../../_shared/gate';
import { operatorTrail } from '../../_shared/OperatorFrame';
import { SetBreadcrumb } from '../../../_shell/SiteHeader';
import { imageOrigins, parseRateParams, RATE_TITLE } from './_rate/model';
import { RateAnglerScreen, RateAnglerSkeleton } from './_rate/RateAnglerScreen';

type Props = { params: Promise<{ bookingId: string }>; searchParams: Promise<SearchParams> };

export const metadata = operatorMetadata(RATE_TITLE);

/** The route params fish's openRateAngler passes (routes.operatorRateAngler); nothing else is kept. */
const KEYS = ['anglerName', 'anglerId', 'anglerAvatar', 'standName', 'startDate', 'endDate'] as const;

/**
 * /operator/evalueaza/[bookingId]?anglerName&anglerId&anglerAvatar&standName&startDate&endDate —
 * operator.evalueaza-pescar «Evaluează pescarul» (T6), fish app/(app)/operator/rate-angler/[bookingId].tsx.
 * Signed in only (operator.b.role-gating): proxy.ts sends a cookie-less request to /intra?next=<this
 * page with its query>, the gate a dead session. Nothing is read here — who and which stay come
 * from the link, validated (model.parseRateParams: capped plain text, the avatar only from the CMS
 * or its S3 bucket, an id-shaped booking or a 404). The CMS owner-gates the write itself. Per
 * owner, never cached, never indexed.
 */
export default function RateAnglerPage({ params, searchParams }: Props) {
  return (
    <>
      <SetBreadcrumb trail={operatorTrail({ label: RATE_TITLE })} />
      <OperatorGate next={nextOf(params, searchParams)} fallback={<RateAnglerSkeleton />}>
        {() => <Rate params={params} searchParams={searchParams} />}
      </OperatorGate>
    </>
  );
}

/** The sign-in return path: this page with the params it was opened with. */
async function nextOf(params: Props['params'], searchParams: Props['searchParams']): Promise<string> {
  const [{ bookingId }, sp] = await Promise.all([params, searchParams]);
  const p: Partial<Record<(typeof KEYS)[number], string>> = {};
  for (const k of KEYS) {
    const v = sp[k];
    const one = Array.isArray(v) ? v[0] : v;
    if (one) p[k] = one;
  }
  return routes.operatorRateAngler(safeDecode(bookingId), p);
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

async function Rate({ params, searchParams }: Props) {
  const [{ bookingId }, sp] = await Promise.all([params, searchParams]);
  const parsed = parseRateParams(bookingId, sp, imageOrigins(process.env.CMS_URL ?? process.env.NEXT_PUBLIC_CMS_URL));
  if (!parsed) notFound();
  return <RateAnglerScreen params={parsed} />;
}
