import { UserGroupIcon } from '@heroicons/react/24/outline';
import { FishIcon, FishingRodIcon } from '@/components/icons/brand';
import { FactTile, StatTile } from '@/components/ui/BentoTile';
import { cn } from '@/components/ui/cn';
import type { StatsTotals } from '@/core/partide';

/*
 * fish StatStrip (parity partide.statistici.c4): partide · pescari · capturi — deliberately no
 * community-wide kg (D1, 2026-07-30: a cumulative kilo figure is meaningless and would compare
 * team-owned kilos against a total they don't sum to). As an Apple-style bento (owner rules 9, 19):
 * Partide is the headline tile (indigo, the rod in the corner), Pescari and Capturi the small fact
 * tiles on their own tints. The page's bento places them (StatsScreen): `lead` is the big tile's
 * slot, `pair` the two facts'.
 */

const n = (v: number) => <span data-testid="stat-value">{v.toLocaleString('ro-RO')}</span>;

export function StatStrip({ totals, caption, leadClassName, pairClassName }: { totals: StatsTotals; caption: string; leadClassName?: string; pairClassName?: string }) {
  return (
    <>
      <div role="group" aria-label="Partide" className={cn('flex', leadClassName)} data-testid="stat-partide">
        <StatTile tone="indigo" label="Partide" icon={<FishingRodIcon />} value={n(totals.partide)} caption={caption} className="w-full" />
      </div>
      <div className={cn('grid grid-cols-2 gap-3 md:gap-4 xl:gap-5', pairClassName)}>
        <div role="group" aria-label="Pescari" className="flex" data-testid="stat-anglers">
          <FactTile tone="lavender" label="Pescari" icon={<UserGroupIcon />} value={n(totals.anglers)} className="w-full" />
        </div>
        <div role="group" aria-label="Capturi" className="flex" data-testid="stat-catches">
          <FactTile tone="sky" label="Capturi" icon={<FishIcon />} value={n(totals.catches)} className="w-full" />
        </div>
      </div>
    </>
  );
}
