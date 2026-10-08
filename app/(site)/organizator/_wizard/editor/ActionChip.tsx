'use client';

import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

/**
 * fish EditorActionChip (rich-text-editor.tsx:83-110): an outlined chip, an accent glyph and an
 * accent label; dimmed and inert while disabled. 44 px tall on touch, 36 from 1280.
 */
export function ActionChip({
  icon,
  children,
  disabled,
  className,
  ...rest
}: Omit<ComponentProps<'button'>, 'children'> & { icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-control bg-surface px-3.5 t-label text-accent-ink shadow-e0',
        'outline-1 -outline-offset-1 outline-hairline xl:h-9',
        'transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-soft-fill active:opacity-75',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface',
        '[&>svg]:size-4 [&>svg]:shrink-0',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
