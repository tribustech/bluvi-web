import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

/**
 * The list's primary action pinned above the phone's thumb («Creează concurs», «Rezervă»): a
 * surface bar on the bottom edge with the safe-area inset, below 768 only. From 768 the same
 * action belongs in ListHeader `actions` — the caller renders it there too. ListPage adds the
 * bottom padding that keeps the last row clear of the bar.
 */
export function StickyActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-sticky flex gap-3 border-t border-hairline bg-surface px-4 pt-3 shadow-tabbar md:hidden',
        'pb-[max(--spacing(3),env(safe-area-inset-bottom))]',
        className,
      )}
    >
      {children}
    </div>
  );
}
