'use client';

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { openPalette } from '@/components/nav/openPalette';
import { useSearchShortcut } from '@/components/nav/TopBar';
import { cn } from '@/components/ui/cn';

/**
 * From 768, Acasă's one big search (owner 2026-10-13, «Acasă într-o coloană»: Airbnb / Booking open
 * on their search). One pill that opens the site's search — the top bar's ⌘K palette (bălți,
 * concursuri, pescari) — so there is one search, reached two ways. The round accent button on the
 * right is the pill's own end, not a second control: the whole pill is the button.
 */
export function HeroSearch({ className }: { className?: string }) {
  const shortcut = useSearchShortcut();
  return (
    <button
      type="button"
      onClick={openPalette}
      aria-haspopup="dialog"
      aria-keyshortcuts="Meta+K Control+K"
      className={cn(
        'group flex h-16 w-full max-w-180 cursor-pointer items-center gap-3 rounded-full bg-surface py-2 pr-2 pl-6 text-left',
        'shadow-[0_1px_2px_rgb(16_24_40/0.06),0_12px_32px_-12px_rgb(67_56_202/0.28)] outline-1 -outline-offset-1 outline-hairline',
        'transition-[box-shadow,transform] duration-(--duration-fast) ease-fast hover:shadow-[0_1px_2px_rgb(16_24_40/0.06),0_18px_40px_-14px_rgb(67_56_202/0.38)] active:scale-[0.995]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="t-body-strong text-ink">Unde mergi la pescuit?</span>
        <span className="truncate t-caption text-muted">Caută bălți, concursuri sau pescari</span>
      </span>
      {shortcut ? (
        <kbd aria-hidden className="t-nano rounded-badge bg-soft-fill px-1.5 py-0.5 text-muted max-lg:hidden">
          {shortcut}
        </kbd>
      ) : null}
      <span
        aria-hidden
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition-colors duration-(--duration-fast) group-hover:bg-accent-ink"
      >
        <MagnifyingGlassIcon className="size-6 stroke-2" />
      </span>
    </button>
  );
}
