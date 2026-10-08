'use client';

import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { formatCount } from '@/core/realtime/chat/format';
import { cn } from '@/components/ui/cn';
import { pillCount } from './model';

/*
 * fish MessageList's scroll-to-bottom button (participant.chat c35): round, bottom right of the
 * conversation, shown once the reader is more than 120 px from the end; the red count is how many
 * new messages it holds back («99+» cap). A click scrolls to the end and shows them.
 */
export function ScrollToEnd({ hidden, onClick, className }: { hidden: number; onClick: () => void; className?: string }) {
  const count = pillCount(hidden);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={hidden > 0 ? `Mergi la ultimul mesaj, ${formatCount(hidden, 'mesaj nou', 'mesaje noi')}` : 'Mergi la ultimul mesaj'}
      className={cn(
        'absolute right-4 bottom-4 z-above flex size-11 cursor-pointer items-center justify-center rounded-full bg-surface text-ink-2 shadow-e2 ring-1 ring-hairline outline-none hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent',
        'opacity-100 transition-opacity duration-(--duration-fast) starting:opacity-0',
        className,
      )}
    >
      <ChevronDownIcon aria-hidden className="size-5.5" />
      {count ? (
        <span aria-hidden className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-live px-1.5 t-micro-strong text-on-accent">
          {count}
        </span>
      ) : null}
    </button>
  );
}
