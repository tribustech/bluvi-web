import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

/**
 * The shell's icon button (Fundații §07: 48 below 1280, 40 from 1280): rounded-control, hover
 * soft-fill (§06, no lift), pressed opacity .8 (the kit Button's), a 24px outline icon slot (§05).
 * Used by ☰, search and the bell in the top bar and by the close buttons of the phone menu and the
 * ⌘K palette, so the shell has one icon-button look.
 *
 * TODO(kit): promote to components/ui/IconButton.tsx (and use it for SidePanel's close) — the shell
 * task may only touch components/nav.
 */
export const ICON_BUTTON_SIZE = 'size-12 xl:size-10';

/**
 * The class list, for a link that must look like the icon button (the bell). `size` overrides the
 * default 48 / 40 (the top bar passes its forced-layout sizes).
 */
export function iconButtonClass({ size = ICON_BUTTON_SIZE, className }: { size?: string; className?: string } = {}) {
  return cn(
    'relative flex shrink-0 cursor-pointer items-center justify-center rounded-control text-ink-2 [&>svg]:size-6',
    'transition-[background-color,color,opacity] duration-(--duration-fast) ease-fast hover:bg-soft-fill hover:text-ink active:opacity-80',
    size,
    className,
  );
}

type Props = Omit<ComponentProps<'button'>, 'aria-label' | 'children'> & {
  /** Required: an icon alone has no name. */
  'aria-label': string;
  /** A 24px outline Heroicon (aria-hidden is up to the caller). */
  children: ReactNode;
  size?: string;
};

export function IconButton({ size, className, type = 'button', children, ...rest }: Props) {
  return (
    <button type={type} className={iconButtonClass({ size, className })} {...rest}>
      {children}
    </button>
  );
}
