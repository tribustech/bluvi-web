'use client';

import { useEffect, useState } from 'react';
import { bookingAgeLabel } from '@/core/booking';

/**
 * «acum 5 min» since `iso` (fish ScaleItem `acum ${formatDistanceToNowStrict(createdAt)}`). The
 * clock is read only after hydration, so the server HTML and the first client render agree; it
 * refreshes every minute.
 */
export function RelativeAge({ iso, className }: { iso: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock starts after hydration
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const label = now === null ? null : bookingAgeLabel(iso, now);
  return (
    <time dateTime={iso} className={className}>
      {label}
    </time>
  );
}
