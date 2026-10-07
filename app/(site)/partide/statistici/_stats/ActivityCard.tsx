'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { seriesDetailLabels, type SeriesPoint, type StatsPeriod } from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';
import { PERIOD_TITLE } from '@/lib/stats-period';
import { ActivityChart } from '../../../ape-publice/_components/venue/ActivityChart';

/*
 * «Activitate» — fish ActivityCard + ActivityLineChart (parity partide.statistici.c5): the period's
 * buckets as a line over a tinted area, on the venue pages' one chart (ape-publice ActivityChart,
 * imported as is). Hovering, touching or arrowing through it names one bucket in the header —
 * «{n} captură/capturi · {label}», the label in full as fish seriesDetailLabels («mie 29 iul»,
 * «29 iul», «Iulie»). The caption names the period while nothing is picked.
 */

/** «now» only in the browser (the detail labels count back from today), null while hydrating. */
const noSubscribe = () => () => {};
const useToday = () => useSyncExternalStore(noSubscribe, () => new Date().toDateString(), () => null);

export function ActivityCard({ period, series, className }: { period: StatsPeriod; series: SeriesPoint[]; className?: string }) {
  const today = useToday();
  const detail = useMemo(() => (today ? seriesDetailLabels(period, series.length, new Date(today)) : series.map((s) => s.label)), [period, series, today]);
  const total = series.reduce((a, s) => a + s.count, 0);
  return (
    <ActivityChart
      className={className}
      testId="activity-card"
      points={series.map((s, i) => ({ label: s.label, count: s.count, detail: detail[i] }))}
      noun={['captură', 'capturi']}
      caption={PERIOD_TITLE[period]}
      summary={`Activitate în comunitate, ${PERIOD_TITLE[period].toLowerCase()}: ${formatCount(total, 'captură', 'capturi')}.`}
    />
  );
}
