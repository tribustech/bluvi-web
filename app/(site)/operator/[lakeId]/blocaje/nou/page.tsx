import { routes } from '@/lib/routes';
import { OperatorGate, operatorMetadata } from '../../../_shared/gate';
import { CreateBlockFallback } from './_form/CreateBlockFallback';
import { CreateBlockScreen } from './_form/CreateBlockScreen';
import { TITLE } from './_form/model';

type Props = { params: Promise<{ lakeId: string }> };

export const metadata = operatorMetadata(TITLE);

/**
 * /operator/[lakeId]/blocaje/nou — operator.blocaj-nou «Adaugă blocaj» (T6), fish
 * app/(app)/operator/[lakeId]/blocks.tsx in add mode. Signed in only (operator.b.role-gating):
 * proxy.ts sends a cookie-less request to /intra?next=<this page>, the gate a dead session; the CMS
 * owner-gates the write (POST /feed/availability-blocks). Everything is per owner — read and written
 * in the browser through /api/cms, never cached, never indexed.
 */
export default function CreateBlockPage({ params }: Props) {
  return (
    <OperatorGate next={params.then(({ lakeId }) => routes.operatorBlockNew(lakeId))} fallback={<CreateBlockFallback />}>
      {() => <Screen params={params} />}
    </OperatorGate>
  );
}

async function Screen({ params }: Props) {
  const { lakeId } = await params;
  return <CreateBlockScreen lakeId={lakeId} />;
}
