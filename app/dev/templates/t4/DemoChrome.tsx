import { DemoStateBar } from '@/components/templates/DemoStateBar';
import { DEMO_STATES, type DemoState } from './states';

/**
 * The dev strip under the top bar (layout.tsx) with the state switcher — the shared DemoStateBar.
 * Not part of the template; it scrolls away with the page. The links keep the demo's `?lake=`.
 * `state: null` = still being read (the Suspense fallback): the same strip, nothing marked current.
 */
export function StateStrip({ state, lake }: { state: DemoState | null; lake?: string }) {
  const href = (key: DemoState) => {
    const q = new URLSearchParams();
    if (key !== 'default') q.set('state', key);
    if (lake) q.set('lake', lake);
    const s = q.toString();
    return `/dev/templates/t4${s ? `?${s}` : ''}`;
  };
  return (
    <DemoStateBar
      label="Stările demonstrației T4"
      title="T4 · stare"
      groups={[DEMO_STATES.map((s) => ({ key: s.key, label: s.label, href: href(s.key), current: s.key === state, title: s.hint }))]}
    />
  );
}
