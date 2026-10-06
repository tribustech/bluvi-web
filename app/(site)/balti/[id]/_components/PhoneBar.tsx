'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { DetailActionBar } from '@/components/templates/T3';
import { cn } from '@/components/ui/cn';

/**
 * The phone's bottom action bar (Airbnb), shown once the hero photo — and its own «Rezervă acum»
 * (fish c6) — has left the screen, so the first screen never carries the same button twice. It
 * slides up from the bottom edge; while it is away it is `inert` (no Tab stop, nothing read).
 */
export function PhoneBar({ label, summary, children }: { label: string; summary: ReactNode; children: ReactNode }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const hero = document.querySelector('[data-t3="photo"]');
    if (!hero) return;
    const io = new IntersectionObserver(([e]) => setShown(!e.isIntersecting), { threshold: 0 });
    io.observe(hero);
    return () => io.disconnect();
  }, []);
  return (
    <DetailActionBar
      label={label}
      summary={summary}
      inert={!shown}
      className={cn(
        'transition-transform duration-(--duration-medium) ease-fast motion-reduce:transition-none',
        shown ? 'translate-y-0' : 'translate-y-full',
      )}
    >
      {children}
    </DetailActionBar>
  );
}
