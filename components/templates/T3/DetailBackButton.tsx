'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { useBack } from '@/components/nav/useBack';
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
  size,
  inApp = false,
  className,
}: {
  fallbackHref: string;
  /**
   * Back only when the previous page is this site's own (components/nav/useBack: the Navigation
   * API's canGoBack), else `fallbackHref` — a page opened from a shared link or a new tab never sends
   * the visitor off the site. Off: any history entry counts (the original behaviour).
   */
  inApp?: boolean;
  onPhoto?: boolean;
  ground?: HeaderChipGround;
  label?: string;
  /** The chip's size utilities (default the kit icon button: 48 / 40). The pinned mini row: size-11. */
  size?: string;
  className?: string;
}) {
  const router = useRouter();
  const inAppBack = useBack(fallbackHref);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => (inApp ? inAppBack() : window.history.length > 1 ? router.back() : router.push(fallbackHref))}
      className={headerChipClass({ ground, onPhoto, size, className })}
    >
      <ChevronLeftIcon aria-hidden />
    </button>
  );
}
