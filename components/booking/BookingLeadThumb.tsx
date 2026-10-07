'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPinIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';

/**
 * fish features/bookings/ui/BookingLeadThumb.tsx — the lake's photo anchoring a booking card on the
 * left. With no photo (the lake has none, the CMS predates `thumbUrl`) or a photo that fails to load,
 * a quiet indigo tile with the pin, so the row keeps its shape. Dead bookings recede: dimmed to .55.
 * Decorative: the lake's name is the text beside it.
 */
export function BookingLeadThumb({ thumbUrl, dimmed = false, className }: { thumbUrl?: string | null; dimmed?: boolean; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = img.current;
    // An error before hydration (onError not attached yet): a finished image with no pixels.
    if (el && el.complete && el.naturalWidth === 0 && thumbUrl) setFailed(thumbUrl);
  }, [thumbUrl]);

  const box = cn('size-10 shrink-0 overflow-hidden rounded-avatar md:size-12', dimmed && 'opacity-55', className);
  if (!thumbUrl || failed === thumbUrl) {
    return (
      <span aria-hidden data-thumb="placeholder" className={cn(box, 'flex items-center justify-center bg-accent-tint text-accent-ink')}>
        <MapPinIcon className="size-5" strokeWidth={1.8} />
      </span>
    );
  }
  return (
    <span aria-hidden data-thumb="photo" className={cn(box, 'bg-soft-fill')}>
      {/* A 48px CMS thumbnail: the image optimizer buys nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={img} src={thumbUrl} alt="" loading="lazy" className="size-full object-cover" onError={() => setFailed(thumbUrl)} />
    </span>
  );
}
