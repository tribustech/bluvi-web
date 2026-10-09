'use client';

import { useState } from 'react';
import { StarIcon } from '@heroicons/react/24/solid';
import { cn } from '@/components/ui/cn';

const STARS = [1, 2, 3, 4, 5] as const;

/** «1 stea», «2 stele» … (each star's name). */
const starLabel = (n: number) => `${n} ${n === 1 ? 'stea' : 'stele'}`;

/**
 * fish react-native-star-rating-widget at starSize 46 (operator.evalueaza-pescar.c4): five large
 * whole stars, never empty. A native radio group, so the keyboard works as everywhere: Tab lands on
 * the chosen star, the arrows move and choose, the group is named by the question above it. Picking
 * the star that is already chosen fires nothing — a score is always set (fish enableSwiping false:
 * a tap never clears it). Each star is a 52px target with a 44px star; hovering previews the fill;
 * the ring shows for keyboard focus only (:focus-visible on the radio, drawn around its star).
 */
export function StarRating({
  labelledBy,
  value,
  onChange,
  disabled = false,
}: {
  labelledBy: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = disabled ? value : (hover ?? value);
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="flex items-center justify-center"
      onMouseLeave={() => setHover(null)}
      data-testid="rate-stars"
    >
      {STARS.map((n) => (
        <label
          key={n}
          className={cn('relative flex size-13 items-center justify-center', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
          onMouseEnter={() => (disabled ? undefined : setHover(n))}
        >
          <input
            type="radio"
            name="stele"
            value={n}
            checked={value === n}
            disabled={disabled}
            aria-label={starLabel(n)}
            onChange={() => onChange(n)}
            className="peer absolute inset-0 size-full cursor-[inherit] appearance-none rounded-full outline-none"
          />
          <StarIcon
            aria-hidden
            className={cn(
              'pointer-events-none size-11 rounded-full transition-[color,transform] duration-(--duration-fast) ease-fast',
              n <= shown ? 'text-rating' : 'text-faint/50',
              hover === n && !disabled && 'motion-safe:scale-110',
              'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
            )}
          />
        </label>
      ))}
    </div>
  );
}
