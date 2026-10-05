'use client';

import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/components/ui/cn';
import { BAR } from './shell';

export type MenuEntry =
  | {
      kind: 'link';
      key: string;
      label: string;
      /** A muted second line (what the entry opens: «Panou baltă»). */
      caption?: string;
      href: string;
      /** The current page ('page') or a page below this entry ('true'); both are tinted. */
      current?: 'page' | 'true';
      icon?: ReactNode;
    }
  | { kind: 'action'; key: string; label: string; onSelect: () => void; icon?: ReactNode; danger?: boolean }
  /** A hairline between groups (before «Ieși din cont»); not focusable, skipped by the arrow keys. */
  | { kind: 'separator'; key: string };

type Props = {
  /** Visible content of the trigger (label + chevron, or the avatar). */
  trigger: ReactNode;
  /** Accessible name of the trigger when its content is not text (the avatar). */
  label?: string;
  /** Optional block at the top of the menu (the account's identity), divided from the rows by a separator. */
  header?: ReactNode;
  entries: MenuEntry[];
  align?: 'start' | 'end';
  triggerClassName?: string;
  /** Closing key: the menu closes whenever it changes (the route). */
  resetKey?: string;
  /** Start open (the /dev/kit static example); the site never sets it. */
  defaultOpen?: boolean;
  /**
   * Where the menu hangs below the trigger (default `top-full mt-2`). The top bar passes the gap
   * that puts it just below its own bottom edge rather than the trigger's.
   */
  menuClassName?: string;
  /** The current page is one of the entries: the trigger's accessible name says so. */
  currentInside?: boolean;
  /**
   * The trigger's action is running («Ieși din cont»): it stays mounted and focusable (focus never
   * drops to <body>) but is aria-disabled + aria-busy, and does not open.
   */
  busy?: boolean;
};

/**
 * Rows are at least 48 / 40 from 1280 (the Button rule: touch size below 1280), with 24 outline
 * icons (Fundații §05), like the phone menu's; a long label wraps to two lines and the row grows.
 * Keyboard focus is the global 2px accent outline, drawn inside the row so the menu's 6px padding
 * never clips it; hover is the soft-fill tint, pressed is opacity .8 (the kit Button's).
 */
const ITEM =
  't-body-strong flex min-h-12 w-full cursor-pointer items-center gap-2.5 rounded-control px-3 py-1.5 text-left transition-[background-color,color,opacity] duration-(--duration-fast) ease-fast focus-visible:-outline-offset-2 active:opacity-80 xl:min-h-10';

/** One hairline style per menu: between the identity block and the rows, and between groups. */
const SEPARATOR = 'mx-2 my-1 h-px shrink-0 bg-hairline';

/** The current page's row: tinted like the bar's active link, icon included. */
const CURRENT = 'bg-accent-tint text-accent-ink [&>svg]:text-accent-ink';

/** Appended to the trigger's name when the current page is inside the menu. */
const CURRENT_INSIDE = ', pagina curentă e în acest meniu';

/**
 * Disclosure menu of the top bar (Administrare, avatar). The popover holds the optional header
 * (identity) and, under it, the role=menu list: a menu may only own menuitems, groups and
 * separators, so the header sits outside it where screen readers read it as text.
 * Opening fades and drops in (@starting-style); closing is instant — the popover unmounts, so the
 * focus and the arrow-key list never hold a hidden menu (documented exit rule for dropdowns). WAI-ARIA menu button: Enter/Space/↓ open
 * on the first item, ↑ on the last; ↑/↓/Home/End move; Escape closes and returns focus to the
 * trigger; Enter/Space on the open trigger closes it; focus leaving the widget (Tab from the
 * trigger or an item), a click outside or a route change close it.
 */
export function MenuButton({
  trigger,
  label,
  header,
  entries,
  align = 'end',
  triggerClassName,
  resetKey,
  defaultOpen = false,
  menuClassName = 'top-full mt-2',
  currentInside = false,
  busy = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [lastKey, setLastKey] = useState(resetKey);
  if (resetKey !== lastKey) {
    setLastKey(resetKey);
    setOpen(false);
  }
  if (busy && open) setOpen(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLElement | null)[]>([]);
  const focusOnOpen = useRef<'first' | 'last' | null>(null);

  useEffect(() => {
    if (!open) return;
    if (focusOnOpen.current) {
      const list = items.current.filter(Boolean);
      (focusOnOpen.current === 'first' ? list[0] : list.at(-1))?.focus();
      focusOnOpen.current = null;
    }
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const focusItem = (which: 'first' | 'last') => {
    const list = items.current.filter((el): el is HTMLElement => el !== null);
    (which === 'first' ? list[0] : list.at(-1))?.focus();
  };

  // Opened by a click the menu is already there: the arrows go straight to an item (the effect
  // above only runs when `open` changes).
  const openWith = (focus: 'first' | 'last') => {
    if (open) {
      focusItem(focus);
      return;
    }
    focusOnOpen.current = focus;
    setOpen(true);
  };

  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (busy) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') e.preventDefault();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open) setOpen(false);
      else openWith('first');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      openWith('first');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      openWith('last');
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = items.current.filter((el): el is HTMLElement => el !== null);
    const at = list.indexOf(document.activeElement as HTMLElement);
    const move = (i: number) => {
      e.preventDefault();
      list[(i + list.length) % list.length]?.focus();
    };
    if (e.key === 'ArrowDown') move(at + 1);
    else if (e.key === 'ArrowUp') move(at - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(list.length - 1);
    else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      button.current?.focus();
    } else if (e.key === 'Tab') setOpen(false);
  };

  // Focus moving to something outside the widget (Tab away from the trigger or an item) closes the
  // menu. A null relatedTarget (Safari does not focus a clicked button) is left to the pointerdown
  // handler, or a click on an item would unmount it before its click lands.
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (open && next && !root.current?.contains(next)) setOpen(false);
  };

  return (
    <div ref={root} className="relative" onBlur={onBlur}>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label && currentInside ? `${label}${CURRENT_INSIDE}` : label}
        aria-disabled={busy || undefined}
        aria-busy={busy || undefined}
        onClick={busy ? undefined : () => setOpen((o) => !o)}
        onKeyDown={onTriggerKey}
        className={cn('cursor-pointer', triggerClassName)}
      >
        {trigger}
      </button>
      {open ? (
        <div
          className={cn(
            'absolute z-above flex w-max flex-col gap-0.5 rounded-card bg-raised p-1.5 text-ink shadow-e2',
            BAR.menuWidth,
            menuClassName,
            'opacity-100 transition-[opacity,translate] duration-(--duration-fast) ease-fast starting:-translate-y-1 starting:opacity-0',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {header ? (
            <>
              <div className="px-3 pt-2 pb-1.5">{header}</div>
              <div aria-hidden className={SEPARATOR} />
            </>
          ) : null}
          <div id={id} role="menu" aria-label={label} onKeyDown={onMenuKey} className="flex flex-col gap-0.5">
          {entries.map((entry, i) => {
            if (entry.kind === 'separator') {
              return <div key={entry.key} role="separator" className={SEPARATOR} />;
            }
            const ref = (el: HTMLElement | null) => {
              items.current[i] = el;
            };
            if (entry.kind === 'link') {
              return (
                <Link
                  key={entry.key}
                  ref={ref}
                  href={entry.href}
                  role="menuitem"
                  tabIndex={-1}
                  aria-current={entry.current}
                  onClick={() => setOpen(false)}
                  className={cn(ITEM, entry.current ? CURRENT : 'text-ink hover:bg-soft-fill')}
                >
                  {entry.icon}
                  <span className="flex min-w-0 flex-col">
                    <span className="line-clamp-2">{entry.label}</span>
                    {entry.caption ? (
                      <span className={cn('t-caption truncate', entry.current ? 'text-accent-ink' : 'text-muted')}>
                        {entry.caption}
                      </span>
                    ) : null}
                  </span>
                </Link>
              );
            }
            return (
              <button
                key={entry.key}
                ref={ref}
                type="button"
                role="menuitem"
                tabIndex={-1}
                // Closing unmounts this item: focus goes back to the trigger first, never to <body>.
                onClick={() => {
                  setOpen(false);
                  button.current?.focus();
                  entry.onSelect();
                }}
                className={cn(ITEM, 'hover:bg-soft-fill', entry.danger ? 'text-status-danger-fg' : 'text-ink')}
              >
                {entry.icon}
                <span className="truncate">{entry.label}</span>
              </button>
            );
          })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
