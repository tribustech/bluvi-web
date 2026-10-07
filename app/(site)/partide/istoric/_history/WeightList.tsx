'use client';

import { OwnPartidaCard } from '@/components/partide/own/OwnPartidaCard';
import { listGridClass } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import type { HistorySection } from './view';

/**
 * «Greutate» on (parity partide.istoric.c3): one flat list, no month labels, sorted by each
 * partidă's record kg descending (core applyHistoryView). The same auto-fill card grid as a month.
 */
export function WeightList({ section, now }: { section: HistorySection; now: number | null }) {
  return (
    <section aria-labelledby="istoric-greutate" className="pt-3" data-testid="history-weight">
      <h2 id="istoric-greutate" className="sr-only">
        Partide după greutatea recordului
      </h2>
      <ul className={cn(listGridClass('md'), 'pb-2')}>
        {section.entries.map(e => (
          <li key={e.session.clientId} className="flex min-w-0 [&>*]:w-full">
            <OwnPartidaCard session={e.session} agg={e.agg} now={now} />
          </li>
        ))}
      </ul>
    </section>
  );
}
