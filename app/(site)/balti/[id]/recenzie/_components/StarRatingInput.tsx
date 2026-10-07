'use client';

import { useId, useState } from 'react';
import { StarIcon } from '@heroicons/react/24/solid';
import { cn } from '@/components/ui/cn';

const STARS = [1, 2, 3, 4, 5] as const;

/** «1 stea», «2 stele» … (aria-label of each star). */
const starLabel = (n: number) => `${n} ${n === 1 ? 'stea' : 'stele'}`;

/**
 * fish RatingItem (react-native-star-rating-widget, step «full», 1–5, never below 1): one whole-star
 * rating as a native radio group, so the keyboard works as everywhere — Tab enters on the chosen
 * star, the arrows move and choose, the group is named by its title. Each star is a 44px target
 * (a 28 / 32px star, fish's 30; 40px targets on a phone, where the label sits on the left of the stars), named «N stele»; hovering previews the fill. The ring shows for keyboard
 * focus only (:focus-visible on the radio, drawn on its star). There is no «0»: the value is always
 * one of 1–5, the default 5 (c2).
 */
export function StarRatingInput({
  label,
  value,
  onChange,
  name,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  name: string;
  disabled?: boolean;
}) {
  const labelId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  return (
    <div className="flex items-center justify-between gap-2 md:flex-col md:justify-start md:gap-1.5" data-testid={`rating-${name}`}>
      <span id={labelId} className="t-heading min-w-0 text-ink">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="-mr-1.5 flex shrink-0 items-center md:mr-0" onMouseLeave={() => setHover(null)}>
        {STARS.map(n => (
          <label
            key={n}
            className={cn('group relative flex size-10 items-center justify-center md:size-11', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
            onMouseEnter={() => (disabled ? undefined : setHover(n))}
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              disabled={disabled}
              aria-label={starLabel(n)}
              onChange={() => onChange(Math.max(1, n))}
              className="peer absolute inset-0 size-full cursor-[inherit] appearance-none rounded-full outline-none"
            />
            <StarIcon
              aria-hidden
              className={cn(
                'pointer-events-none size-7 rounded-full md:size-8 transition-[color,transform] duration-(--duration-fast) ease-fast',
                n <= shown ? 'text-rating' : 'text-muted',
                hover === n && 'scale-110',
                'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
              )}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
