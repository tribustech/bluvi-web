import { DemoStateBar } from '@/components/templates/DemoStateBar';
import { DEMO_STATES, TEMPLATE_ONLY_STATES, type DemoState } from './states';

/**
 * Dev strip above the template (the shared DemoStateBar): every state as a link (?state=…). Not
 * part of T2. `current` is the state the URL asks for (null while it is not known yet: the
 * Suspense fallback). Template-only states (not parity) are dashed.
 */
export function StateSwitcher({ current }: { current: DemoState | null }) {
  return (
    <DemoStateBar
      label="Stări demo T2"
      title="T2 · Listă cu hartă"
      groups={[
        (Object.keys(DEMO_STATES) as DemoState[]).map((s) => ({
          key: s,
          label: DEMO_STATES[s],
          href: s === 'results' ? '?' : `?state=${s}`,
          current: s === current,
          dashed: TEMPLATE_ONLY_STATES.has(s),
        })),
      ]}
    />
  );
}
