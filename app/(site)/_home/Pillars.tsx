import type { ComponentType, SVGProps } from 'react';
import { ChartBarIcon, ClockIcon, MapPinIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { DashboardSection } from '@/components/templates/T5';
import { cn } from '@/components/ui/cn';

type Pillar = { kicker: string; headline: string; Icon: ComponentType<SVGProps<SVGSVGElement>> };

/** fish app/onboarding.tsx STORIES — the kicker and the headline (its two lines as one sentence). */
const PILLARS: Pillar[] = [
  { kicker: 'DESCOPERĂ', headline: 'Următoarea partidă începe aici.', Icon: MapPinIcon },
  { kicker: 'TRĂIEȘTE PARTIDA', headline: 'Fiecare lansetă. Fiecare moment.', Icon: ClockIcon },
  { kicker: 'INTRĂ ÎN COMPETIȚIE', headline: 'Emoția concursului. Captură cu captură.', Icon: TrophyIcon },
  { kicker: 'ÎNȚELEGE PESCUITUL', headline: 'Mai mult decât o captură.', Icon: ChartBarIcon },
];

/**
 * account.onboarding web replacement: the signed-out home says what Bluvi is with fish's four
 * onboarding pillars. Below 1280 a plain section under the header card (main column): a 2×2 bento
 * on the phone, one row of four from 768. From 1280 a card in the right column under Instrumente,
 * one row per pillar (the column is 320–360px: a 2×2 there wraps every headline to four lines). Guests only (SignedOutOnly).
 */
export function Pillars({ layout }: { layout: 'mobile' | 'desktop' }) {
  const desktop = layout === 'desktop';
  return (
    <DashboardSection variant={desktop ? 'card' : 'plain'} title="Ce găsești pe Bluvi">
      <ul className={cn('grid gap-2', desktop ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-4 md:gap-3')}>
        {PILLARS.map(({ kicker, headline, Icon }) => (
          <li
            key={kicker}
            className={cn(
              'flex gap-2 rounded-card',
              desktop ? 'flex-row items-start gap-3 bg-soft-fill p-3' : 'flex-col bg-surface p-3.5 shadow-e0',
            )}
          >
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full text-accent-ink',
                desktop ? 'bg-surface' : 'bg-accent-tint',
              )}
            >
              <Icon aria-hidden className="size-4.5" />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="t-eyebrow text-accent-ink">{kicker}</span>
              <span className="t-body-strong text-ink">{headline}</span>
            </span>
          </li>
        ))}
      </ul>
    </DashboardSection>
  );
}
