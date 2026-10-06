'use client';

import { useSearchParams } from 'next/navigation';
import { DemoStateBar } from '@/components/templates/DemoStateBar';
import { STATES, type DemoState } from './states';

/** Reads ?state= on the client, so the switcher renders outside the page's data Suspense. */
export function StateSwitcher() {
  const state = useSearchParams().get('state') ?? '';
  return <StateSwitcherView current={STATES.some((s) => s.value === state) ? (state as DemoState) : ''} />;
}

/**
 * Demo chrome (the shared DemoStateBar): one chip per state. Not part of the template.
 * `current` undefined (the Suspense fallback): same chips, none marked, same height.
 */
export function StateSwitcherView({ current }: { current?: DemoState }) {
  return (
    <DemoStateBar
      label="Stări demo T6"
      title="T6 · demo"
      groups={[
        STATES.map((s) => ({
          key: s.value || 'default',
          label: s.label,
          href: s.value ? `/dev/templates/t6?state=${s.value}` : '/dev/templates/t6',
          current: s.value === current,
        })),
      ]}
    />
  );
}
