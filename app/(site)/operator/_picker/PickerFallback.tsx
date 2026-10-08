import { OPERATOR_PICKER_TITLE, OperatorFrame } from '../_shared/OperatorFrame';
import { PICKER_BACK } from './model';
import { PickerLoader } from './PickerScreen';

/** The picker's first paint (Suspense fallback and loading.tsx): the real header + the loader (c1, c2). */
export function PickerFallback() {
  return (
    <OperatorFrame title={OPERATOR_PICKER_TITLE} back={PICKER_BACK}>
      <PickerLoader />
    </OperatorFrame>
  );
}
