'use client';

import { useMemo } from 'react';
import type { StatsPeriod } from '@/core/partide';
import { routes } from '@/lib/routes';
import { StatsScreen, type StatsLinks } from './StatsScreen';

/** The page's client entry: builds the venue and the targets (functions cannot cross from the server). */
export function StatsRoute({ code, waterKey, title, initialPeriod }: { code: string; waterKey: string; title: string; initialPeriod: StatsPeriod }) {
  const venue = useMemo(() => ({ kind: 'water', code }) as const, [code]);
  const links = useMemo<StatsLinks>(
    () => ({
      partide: routes.publicWaterPartide(waterKey),
      ranking: (p) => routes.publicWaterRanking(waterKey, p),
      catches: routes.publicWaterCatches(waterKey),
    }),
    [waterKey],
  );
  return <StatsScreen venue={venue} waterKey={waterKey} title={title} backHref={routes.publicWater(waterKey)} links={links} initialPeriod={initialPeriod} />;
}
