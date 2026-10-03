'use client';

import { useId, type ReactNode } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';

type Props = {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/**
 * Desktop side panel (≥1280), 420px: details of a stand, an angler or a weighing while the list
 * stays visible and usable — so it is NOT modal (no scrim, no focus trap). The page layout docks
 * it (sticky column next to the content); Escape inside it closes it.
 */
export function SidePanel({ title, subtitle, onClose, children, footer, className }: Props) {
  const titleId = useId();
  return (
    <aside
      aria-labelledby={titleId}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      className={cn(
        'flex w-[420px] max-w-full flex-col bg-surface text-ink shadow-panel',
        'translate-x-0 opacity-100 transition-[translate,opacity] duration-(--duration-slow) ease-slow starting:translate-x-6 starting:opacity-0',
        className,
      )}
    >
      <header className="flex items-start gap-3 px-5 pt-5 pb-3">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="t-title2 truncate">
            {title}
          </h2>
          {subtitle ? <div className="t-caption text-muted">{subtitle}</div> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Închide"
          className="flex size-10 shrink-0 items-center justify-center rounded-control text-ink-2 hover:bg-soft-fill"
        >
          <XMarkIcon className="size-5" aria-hidden />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
      {footer ? <div className="border-t border-hairline px-5 py-4">{footer}</div> : null}
    </aside>
  );
}
