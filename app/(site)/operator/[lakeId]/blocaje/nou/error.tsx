'use client';

import { useParams } from 'next/navigation';
import { FlowHeader, FlowLayout } from '@/components/templates/T6';
import { routes } from '@/lib/routes';
import { OperatorRouteError } from '../../../_shared/OperatorErrorState';
import { TITLE, TITLE_ID } from './_form/model';

/** The form's header + OperatorRouteError: «Serverul nu răspunde» for a server failure, «Ceva n-a mers» for a browser crash. */
export default function CreateBlockError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { lakeId } = useParams<{ lakeId: string }>();
  return (
    <FlowLayout
      header={
        <FlowHeader
          title={TITLE}
          id={TITLE_ID}
          backHref={lakeId ? routes.operatorBlocks(lakeId) : routes.operator()}
          backLabel="Înapoi la blocaje"
        />
      }
      variant="bare"
      narrow
      labelledBy={TITLE_ID}
    >
      <OperatorRouteError error={error} retry={retry} scope="operator.blocaj-nou" />
    </FlowLayout>
  );
}
