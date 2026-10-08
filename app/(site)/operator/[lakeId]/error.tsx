'use client';

import { routes } from '@/lib/routes';
import { OperatorRouteError } from '../_shared/OperatorErrorState';
import { OperatorFrame, operatorTrail } from '../_shared/OperatorFrame';
import { PANEL_TITLE } from './_panel/model';

/** The panel's frame + OperatorRouteError: «Serverul nu răspunde» for a server failure (digest), «Ceva n-a mers» for a browser crash. */
export default function OperatorPanelError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <OperatorFrame title={PANEL_TITLE} back={{ fallbackHref: routes.home() }} trail={operatorTrail({ label: PANEL_TITLE })}>
      <OperatorRouteError error={error} retry={retry} scope="operator.panou" />
    </OperatorFrame>
  );
}
