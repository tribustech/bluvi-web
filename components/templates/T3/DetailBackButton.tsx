'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { headerChipClass, type HeaderChipGround } from './DetailHeader';

/**
 * fish BackButton: back in history, or `fallbackHref` when the page was opened directly (a shared
 * link). `ground` picks the chip's fill for what it sits on (DetailHeader headerChipClass): the
 * white header (default), the grey page (whole-page states), a photo (`onPhoto`, the same as
 * `ground="photo"`).
 */
export function DetailBackButton({
  fallbackHref,
  onPhoto = false,
  ground,
  label = 'Înapoi',
  className,
}: {
  fallbackHref: string;
  onPhoto?: boolean;
  ground?: HeaderChipGround;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallbackHref))}
      className={headerChipClass({ ground, onPhoto, className })}
    >
      <ChevronLeftIcon aria-hidden />
    </button>
  );
}
