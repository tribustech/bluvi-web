'use client';

import { OperatorRouteError } from './_shared/OperatorErrorState';
import { OPERATOR_PICKER_TITLE, OperatorFrame } from './_shared/OperatorFrame';
import { PICKER_BACK } from './_picker/model';

/** The picker's frame + OperatorRouteError: «Serverul nu răspunde» for a server failure (digest), «Ceva n-a mers» for a browser crash. */
export default function OperatorPickerError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <OperatorFrame title={OPERATOR_PICKER_TITLE} back={PICKER_BACK}>
      <OperatorRouteError error={error} retry={retry} scope="operator" />
    </OperatorFrame>
  );
}
