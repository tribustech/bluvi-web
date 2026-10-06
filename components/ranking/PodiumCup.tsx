import { cn } from '@/components/ui/cn';
import { MEDAL_TEXT, type MedalPlace } from './medal';

/*
 * fish features/competitions/components/cards/PodiumCup.tsx — a cup carrying the podium place, for
 * places 1–3. Single-colour artwork on currentColor (the brand-icon rule) in the medal tokens, the
 * place inside the SVG in the navy on-medal digit (6.7 / 5.7 / 4.9:1, both themes).
 */
export function PodiumCup({ place, className }: { place: MedalPlace; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label={`Locul ${place}`} className={cn('size-8 shrink-0', MEDAL_TEXT[place], className)}>
      <path d="M12 6h24v12c0 8-5.4 13.5-12 13.5S12 26 12 18z" fill="currentColor" />
      <path
        d="M12 9.5H6.5c0 6.5 2.8 10.2 6.8 11M36 9.5h5.5c0 6.5-2.8 10.2-6.8 11"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <rect x={21.3} y={31} width={5.4} height={5} fill="currentColor" />
      <rect x={14} y={36} width={20} height={6} rx={2} fill="currentColor" />
      <text x={24} y={23.5} textAnchor="middle" className="t-num-18 fill-on-medal">
        {place}
      </text>
    </svg>
  );
}
