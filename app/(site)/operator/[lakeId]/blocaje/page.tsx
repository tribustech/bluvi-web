import { routes } from '@/lib/routes';
import { OperatorGate, operatorMetadata } from '../../_shared/gate';
import { BlocksScreen } from './_list/BlocksScreen';
import { BlocksFallback } from './_list/frame';
import { BLOCKS_TITLE } from './_list/model';

type Props = { params: Promise<{ lakeId: string }> };

export const metadata = operatorMetadata(BLOCKS_TITLE);

/**
 * /operator/[lakeId]/blocaje — operator.blocaje «Blocaje și închideri» (T1), fish
 * app/(app)/operator/[lakeId]/blocks.tsx. Signed in only (operator.b.role-gating): proxy.ts sends a
 * cookie-less request to /intra?next=<this page>, the gate a dead session; the CMS owner-gates the
 * blocks itself (a refusal is the screen's «Nu ai acces»). Per owner: read in the browser through
 * /api/cms, never cached, never indexed.
 */
export default function OperatorBlocksPage({ params }: Props) {
  const next = params.then(({ lakeId }) => routes.operatorBlocks(lakeId));
  return (
    <OperatorGate next={next} fallback={<BlocksFallback />}>
      {() => <Blocks params={params} />}
    </OperatorGate>
  );
}

async function Blocks({ params }: Props) {
  const { lakeId } = await params;
  return <BlocksScreen lakeId={lakeId} />;
}
