import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { routes } from '@/lib/routes';
import type { Viewer } from '@/lib/server/viewer';
import { OperatorGate, operatorMetadata } from './_shared/gate';
import { OPERATOR_PICKER_TITLE } from './_shared/OperatorFrame';
import { PickerFallback } from './_picker/PickerFallback';
import { PickerScreen } from './_picker/PickerScreen';

/** The shared e2e fault cookie (app/(site)/_home/data.ts FAULT_COOKIE). */
const FAULT_COOKIE = 'bluvi_e2e_fault';

export const metadata = operatorMetadata(OPERATOR_PICKER_TITLE);

/**
 * /operator — operator.alege-balta «Administrare lacuri» (T1). Signed in only (operator.b.role-gating):
 * proxy.ts sends a cookie-less request to /intra?next=/operator, the gate (inside the Suspense
 * boundary, Cache Components) a dead session. The owned lakes are per user — read in the browser
 * through /api/cms, never cached, never indexed. Being an operator = that list is non-empty; the
 * page itself says so («Nu administrezi niciun lac.»).
 *
 * operator.b.single-lake (c4): the gate's Viewer already carries the owned lakes (the shell's
 * Administrare menu read them), so exactly one lake redirects (replace) to its panel on the server —
 * no picker header, no loader, no second read (fish shows only a spinner here). An empty list there
 * may be a failed read (readOwnedLakes swallows errors), so the picker's client-side replace stays
 * as the fallback.
 */
export default function OperatorPickerPage() {
  return (
    <OperatorGate next={routes.operator()} fallback={<PickerFallback />}>
      {(viewer) => <SingleLakeRedirect viewer={viewer} />}
    </OperatorGate>
  );
}

async function SingleLakeRedirect({ viewer }: { viewer: Viewer }) {
  const owned = (await serverReadFailed()) ? [] : viewer.ownedLakes;
  const only = owned.length === 1 ? owned[0]?.documentId : undefined;
  if (only) redirect(routes.operator(only));
  return <PickerScreen />;
}

/**
 * Test-only (tests/e2e/operator-alege-balta.spec.ts): the `bluvi_e2e_fault` cookie label
 * `operator-owned-lakes` makes the server's owned-lakes read count as failed, so the picker's
 * client path runs and its states can be route-mocked for the single-lake QA user. Off in a
 * production build unless BLUVI_E2E_FAULTS=1, as app/(site)/_home/data.ts.
 */
async function serverReadFailed(): Promise<boolean> {
  if (process.env.NODE_ENV === 'production' && process.env.BLUVI_E2E_FAULTS !== '1') return false;
  const value = (await cookies()).get(FAULT_COOKIE)?.value;
  return !!value && value.split(',').some((l) => l.trim() === 'operator-owned-lakes');
}
