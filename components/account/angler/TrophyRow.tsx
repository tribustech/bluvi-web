import { cn } from '@/components/ui/cn';
import { trophyTiers } from '@/core/social';

/*
 * fish components/profile/TrophyRow.tsx (parity account.angler-profile c8): 🥇 🥈 🥉 with their
 * counts, only the tiers above zero; no row at all when the angler never made a podium.
 */

const TIER = {
  first: { emoji: '🥇', spoken: 'locul 1' },
  second: { emoji: '🥈', spoken: 'locul 2' },
  third: { emoji: '🥉', spoken: 'locul 3' },
} as const;

export function TrophyRow({ podium, className }: { podium: { first: number; second: number; third: number }; className?: string }) {
  const tiers = trophyTiers(podium);
  if (!tiers.length) return null;
  return (
    <ul aria-label="Podiumuri" className={cn('flex justify-center gap-4', className)} data-testid="trophy-row">
      {tiers.map(t => (
        <li key={t.key} className="flex items-center gap-1" data-tier={t.key}>
          <span aria-hidden className="t-body">
            {TIER[t.key].emoji}
          </span>
          <span className="t-label text-ink tabular-nums">{t.count}</span>
          <span className="sr-only">{` × ${TIER[t.key].spoken}`}</span>
        </li>
      ))}
    </ul>
  );
}
