import { routes } from '@/lib/routes';
import { OperatorGate, operatorMetadata } from '../_shared/gate';
import { PANEL_TITLE } from './_panel/model';
import { PanelFallback } from './_panel/PanelFallback';
import { PanelScreen } from './_panel/PanelScreen';

type Props = {
  params: Promise<{ lakeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = operatorMetadata(PANEL_TITLE);

/**
 * /operator/[lakeId] — operator.panou «Panoul bălții» (T5). Signed in only (operator.b.role-gating):
 * proxy.ts sends a cookie-less request to /intra?next=<this path>, the gate (inside the Suspense
 * boundary, Cache Components) a dead session. Ownership is the CMS's: GET operator-stats refuses a
 * lake the viewer does not own (403 → «Nu ai acces» in the screen). Everything is per owner — read
 * in the browser through /api/cms, never cached, never indexed.
 */
export default function OperatorPanelPage({ params, searchParams }: Props) {
  return (
    <OperatorGate next={nextOf(params, searchParams)} fallback={<PanelFallback />}>
      {() => <Panel params={params} />}
    </OperatorGate>
  );
}

async function Panel({ params }: Pick<Props, 'params'>) {
  const { lakeId } = await params;
  return <PanelScreen lakeId={lakeId} />;
}

/** Where /intra returns: this path with its query (an open ?rezervare= survives the sign-in). */
async function nextOf(params: Props['params'], searchParams: Props['searchParams']): Promise<string> {
  const [{ lakeId }, sp] = await Promise.all([params, searchParams]);
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const one of Array.isArray(v) ? v : v === undefined ? [] : [v]) q.append(k, one);
  const s = q.toString();
  return `${routes.operator(lakeId)}${s ? `?${s}` : ''}`;
}
