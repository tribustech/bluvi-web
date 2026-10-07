'use client';

import type { MemberTabProps } from './types';

/** The placeholder body of a tab whose batch has not shipped (only ever shown to the frame's tests). */
export function TabStub({ tab, events }: MemberTabProps & { tab: string }) {
  return (
    <section data-testid={`partida-tab-stub-${tab.toLowerCase()}`} className="bg-surface px-4 py-8 text-center md:rounded-card md:shadow-e0">
      <p className="t-body text-muted">
        {tab} · {events.length}
      </p>
    </section>
  );
}
