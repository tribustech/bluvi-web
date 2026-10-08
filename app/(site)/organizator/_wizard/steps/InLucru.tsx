import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import { T4Section } from '@/components/templates/T4';

/**
 * The neutral placeholder a step shows until its batch (M6-B2…B4) replaces the stub: no field, no
 * fake data (owner rule 4) — the frame (header, step bar, auto-save, action bar, dialogs) still runs.
 */
export function InLucru({ title }: { title: string }) {
  return (
    <T4Section title={title} icon={<WrenchScrewdriverIcon />}>
      <p className="t-body text-muted" data-testid="wizard-step-stub">
        În lucru
      </p>
    </T4Section>
  );
}
