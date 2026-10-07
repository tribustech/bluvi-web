'use client';

import Link from 'next/link';
import { useId, type ReactNode } from 'react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { TileChevron } from '@/components/templates/T6/TileChevron';
import { cn } from '@/components/ui/cn';
import { ROW_FOCUS, ROW_HELPER, ROW_ICON, ROW_LINE, ROW_PAD_X } from './styles';

/**
 * fish InfoCardItem with `onPress` + a chevron: a row that opens another screen («Concursuri
 * urmărite», «Editează profilul»), with an optional helper line under it. The whole block — line and
 * helper — is ONE link (one tab stop, one big target); its accessible name is the label alone, the
 * helper is its description. While the navigation is pending the chevron turns into a spinner
 * (T6 TileChevron), so a slow tap never reads as dead.
 *
 * `onClick` instead of `href`: a row that acts in place (fish «Deconectează-te»), a button.
 * `disabled`: fish's `onPress: undefined` — not activatable: no href, no tab stop, aria-disabled on a
 * role=link element (assistive tech still finds it and hears «dezactivat»); dim it with the card's
 * `inactive`.
 */
export function NavRow({
  icon,
  label,
  helper,
  href,
  onClick,
  disabled = false,
  tone = 'default',
}: {
  icon?: ReactNode;
  label: string;
  helper?: ReactNode;
  /** The screen it opens. */
  href?: string;
  /** Or an action in place (rendered as a button). */
  onClick?: () => void;
  disabled?: boolean;
  /** `danger`: a destructive row (label in the danger colour, fish labelColor red). */
  tone?: 'default' | 'danger';
}) {
  const labelId = useId();
  const helperId = useId();
  const body = (chevron: ReactNode) => (
    <>
      <span className={ROW_LINE}>
        {icon ? (
          <span aria-hidden className={ROW_ICON}>
            {icon}
          </span>
        ) : null}
        <span id={labelId} className={cn('t-body-strong min-w-0 flex-1', tone === 'danger' ? 'text-status-danger-fg' : 'text-ink')}>
          {label}
        </span>
        {chevron}
      </span>
      {helper ? (
        <span id={helperId} className={cn('block', ROW_HELPER)}>
          {helper}
        </span>
      ) : null}
    </>
  );
  const a11y = { 'aria-labelledby': labelId, 'aria-describedby': helper ? helperId : undefined };
  const staticChevron = <ChevronRightIcon aria-hidden className="size-6 shrink-0 self-center text-ink-2" />;

  if (disabled) {
    return (
      <div role="link" aria-disabled="true" {...a11y} className={cn('block cursor-default', ROW_PAD_X)}>
        {body(staticChevron)}
      </div>
    );
  }
  const active = cn('block transition-colors duration-(--duration-fast) ease-fast hover:bg-soft-fill active:bg-soft-fill', ROW_PAD_X, ROW_FOCUS);
  if (href) {
    return (
      <Link href={href} {...a11y} className={active}>
        {body(<TileChevron />)}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} {...a11y} className={cn(active, 'w-full text-left')}>
      {body(null)}
    </button>
  );
}
