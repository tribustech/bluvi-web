'use client';

import { WizardRouteError } from '../../../_wizard/WizardRouteError';

/** The session could not be read (or the page failed): «Serverul nu răspunde» with a retry. */
export default function NewCompetitionError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <WizardRouteError error={error} retry={retry} />;
}
