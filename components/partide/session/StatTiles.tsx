'use client';

import type { ReactNode } from 'react';
import { ClockIcon, StarIcon } from '@heroicons/react/24/outline';
import { FishIcon } from '@/components/icons/brand';
import { BENTO_INK, bentoSurface, type BentoTone } from '@/components/ui/BentoTile';
import { cn } from '@/components/ui/cn';
import { SignatureNumber } from '@/components/ui/SignatureNumber';
import { elapsedRoCompact, fmtKg, type CommunitySessionDetailDTO } from '@/core/partide';
import { durationLabel } from './format';
import { useNow } from './useNow';

/*
 * The three facts beside the total (parity partide.spectator.c7, fish comunitate/[id].tsx stats
 * row): «cea mai mare» (max kg, amber + star), «capturi» (count, lavender + fish), «durată» (an
 * ended partidă's length) or «în desfășurare» (a live one's elapsed time, ticking in the browser).
 * fish's anatomy — icon, number, the word under it — on Apple-style bento surfaces, each tile its
 * own tint (owner rule 19). A number's unit is its own smaller word (rule 10): «6 h», never «6h».
 * Nothing weighed → «—».
 */

/** «6h» / «45m» / «de 2h» → the number and its unit word («h», «min»). */
export function splitDuration(label: string): { value: string; unit: string } {
  const m = label.replace(/^de /, '').match(/^(\d+)\s*([hm])$/);
  if (!m) return { value: label, unit: '' };
  return { value: m[1], unit: m[2] === 'h' ? 'h' : 'min' };
}

function Tile({ tone, icon, value, unit, label, testId }: { tone: BentoTone; icon: ReactNode; value: ReactNode; unit?: string; label: ReactNode; testId?: string }) {
  const ink = BENTO_INK[tone];
  return (
    <li data-testid={testId} className={cn(bentoSurface(tone), 'flex min-w-0 flex-col items-start gap-2 rounded-bento p-3 md:p-4')}>
      <span aria-hidden className="flex size-8 items-center justify-center rounded-control bg-surface/70 [&>svg]:size-4.5">
        {icon}
      </span>
      <SignatureNumber size="fact" value={value} unit={unit} tone={ink.number} unitTone={ink.unit} className="whitespace-nowrap" />
      <span className={cn('t-micro whitespace-nowrap md:t-caption', ink.fg)}>{label}</span>
    </li>
  );
}

export function StatTiles({
  detail,
  className,
}: {
  detail: Pick<CommunitySessionDetailDTO, 'maxKg' | 'catchCount' | 'startedAt' | 'endedAt' | 'durationMs'>;
  className?: string;
}) {
  const now = useNow();
  const live = detail.endedAt == null;
  const time = durationLabel(detail) ?? (live && now != null ? elapsedRoCompact(now, detail.startedAt) : null);
  const duration = time ? splitDuration(time) : null;
  return (
    <ul aria-label="Pe scurt" data-testid="partida-tiles" className={cn('grid grid-cols-3 gap-2 md:gap-3', className)}>
      <Tile
        tone="amber"
        icon={<StarIcon />}
        value={detail.maxKg != null ? fmtKg(detail.maxKg) : '—'}
        unit={detail.maxKg != null ? 'kg' : undefined}
        label="cea mai mare"
        testId="partida-tile-max"
      />
      <Tile tone="lavender" icon={<FishIcon />} value={String(detail.catchCount)} label="capturi" testId="partida-tile-count" />
      <Tile
        tone="mint"
        icon={<ClockIcon />}
        testId="partida-tile-duration"
        value={
          duration ? (
            <span data-visual-mask={live || undefined}>{duration.value}</span>
          ) : (
            // A live partidă's elapsed time exists only in the browser (useNow): a bone until then.
            <span aria-hidden className="inline-block h-[0.7em] w-10 animate-shimmer rounded-full align-middle" />
          )
        }
        unit={duration?.unit || undefined}
        label={live ? 'în desfășurare' : 'durată'}
      />
    </ul>
  );
}
