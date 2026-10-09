'use client';

import { useParams } from 'next/navigation';
import { routes } from '@/lib/routes';
import { OperatorRouteError } from '../../_shared/OperatorErrorState';
import { OperatorFrame } from '../../_shared/OperatorFrame';
import { BLOCKS_TITLE } from './_list/model';

/** The blocks' frame + OperatorRouteError: «Serverul nu răspunde» for a server failure, «Ceva n-a mers» for a browser crash. */
export default function OperatorBlocksError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { lakeId } = useParams<{ lakeId: string }>();
  return (
    <OperatorFrame title={BLOCKS_TITLE} back={{ fallbackHref: lakeId ? routes.operator(lakeId) : routes.operator() }}>
      <OperatorRouteError error={error} retry={retry} scope="operator.blocaje" />
    </OperatorFrame>
  );
}
