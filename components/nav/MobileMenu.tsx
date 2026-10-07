'use client';

import { useEffect, useId, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowPathIcon,
  ArrowRightStartOnRectangleIcon,
  BellIcon,
  Cog6ToothIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { BREAKPOINT_MD } from '@/components/surfaces/rule';
import { useModalDialog } from '@/components/surfaces/useModalDialog';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { ON_WEB } from '@/lib/routes';
import { LogoHorizontal } from './brand';
import { IconButton } from './IconButton';
import { PATHS, PROFILE_ITEM, SECTIONS, SIGN_IN_ITEM, type AdminLink, type NavItem } from './items';
import { BAR } from './shell';

/**
 * in / out; pending = still resolving (no account row yet); unknown = the read failed — shown exactly
 * like pending (owner rule 4: when we don't know, we don't show); the shell re-reads it quietly.
 */
export type MenuSession = 'in' | 'out' | 'pending' | 'unknown';

type Props = {
  open: boolean;
  onClose: () => void;
  /**
   * in: the account group (Profil, Notificări, Setări, Ieși din cont); out: «Intră în cont» pinned
   * at the bottom; pending and unknown: neither yet.
   */
  session: MenuSession;
  /** «Ieși din cont» (signed in). */
  onSignOut?: () => void;
  /** A sign-out is running: its row is busy. */
  signingOut?: boolean;
  /** @deprecated Ignored: an unknown session shows no retry row. */
  onRetry?: () => void;
  /** An Administrare retry (onAdminRetry) is running: its row is busy. */
  retrying?: boolean;
  /** Where «Intră» goes (returns to the current page). */
  signInHref?: string;
  active?: string;
  /** 'page': the current page is the active entry's own; 'true': it lies below it. */
  activeCurrent?: 'page' | 'true';
  admin?: AdminLink[];
  /** The viewer's lakes could not be read: Administrare stays with a retry row (TopBar `onAdminRetry`). */
  onAdminRetry?: () => void;
  /** Changes on navigation: the panel closes. */
  resetKey?: string;
};

/** Rows: 48px, pressed opacity .8 (the kit Button's), hover soft-fill. */
const ROW =
  't-body-strong flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-control px-3 py-1.5 text-left transition-[background-color,color,opacity] duration-(--duration-fast) ease-fast active:opacity-80';

/**
 * One left column for the whole panel: the logo, the row icons and the group eyebrows all start
 * 24px from the panel's edge (header pl-6; nav px-3 + row px-3), separators span the rows' width.
 */
const SEPARATOR = 'mx-3 my-3 h-px bg-hairline';
const EYEBROW = 't-eyebrow px-3 pb-1 text-muted uppercase';

/** The avatar menu's entries, so ☰ alone covers everything on a phone. */
const ACCOUNT: { key: string; label: string; href: string; Icon: NavItem['Icon'] }[] = [
  PROFILE_ITEM,
  { key: 'notificari', label: 'Notificări', href: PATHS.notifications, Icon: BellIcon },
  // /setari only once the web has it (ON_WEB.settings) — never a row to the 404.
  ...(ON_WEB.settings ? [{ key: 'setari', label: 'Setări', href: PATHS.settings, Icon: Cog6ToothIcon }] : []),
];

/**
 * Phone menu (<768), opened by ☰ in the top bar: a modal panel from the right edge. Native
 * <dialog> via useModalDialog — focus is trapped inside, Escape and a tap on the scrim close it,
 * focus returns to ☰. It also closes on any route change (a link inside, or back/forward).
 * It is the complete menu on a phone: the sections, Administrare, and the account (the same entries
 * as the avatar menu) — or, signed out, one emphasised «Intră în cont» at the bottom.
 */
export function MobileMenu({
  open,
  onClose,
  session,
  onSignOut,
  signingOut = false,
  retrying = false,
  signInHref,
  active,
  activeCurrent = 'page',
  admin = [],
  onAdminRetry,
  resetKey,
}: Props) {
  const dialog = useModalDialog(open, onClose);
  const titleId = useId();
  const adminId = useId();
  const accountId = useId();

  // Close when the route changes while open (back/forward, or a link that is not in the panel).
  const lastKey = useRef(resetKey);
  useEffect(() => {
    if (resetKey === lastKey.current) return;
    lastKey.current = resetKey;
    if (open) onClose();
  }, [resetKey, open, onClose]);

  // The panel is phone-only: crossing 768 while it is open (rotation, a resized window) closes it,
  // and focus goes to the page, not to the now-hidden ☰.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia(`(min-width: ${BREAKPOINT_MD}px)`);
    const onChange = () => {
      if (!mq.matches) return;
      onClose();
      requestAnimationFrame(() => document.getElementById('continut')?.focus({ preventScroll: true }));
    };
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [open, onClose]);

  const linkRow = (key: string, href: string, label: string, Icon: NavItem['Icon'] | undefined, caption?: string) => {
    const isActive = key === active;
    return (
      <li key={key}>
        <Link
          href={href}
          onClick={onClose}
          aria-current={isActive ? activeCurrent : undefined}
          className={cn(ROW, isActive ? 'bg-accent-tint text-accent-ink' : 'text-ink hover:bg-soft-fill')}
        >
          {Icon ? <Icon className={cn('size-6 shrink-0', isActive ? 'text-accent-ink' : 'text-ink-2')} aria-hidden /> : null}
          <span className="flex min-w-0 flex-col">
            <span className="line-clamp-2">{label}</span>
            {caption ? (
              <span className={cn('t-caption truncate', isActive ? 'text-accent-ink' : 'text-muted')}>{caption}</span>
            ) : null}
          </span>
        </Link>
      </li>
    );
  };

  const signedOut = session === 'out';

  return (
    <dialog
      {...dialog}
      aria-labelledby={titleId}
      className={cn(
        'fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none max-w-none bg-surface p-0 text-ink shadow-panel',
        BAR.panelWidth,
        'open:flex open:flex-col',
        // Both ways: slides in and out (medium, ease-slow); display/overlay are transitioned
        // discretely so the closing panel stays in the top layer until it is off-screen. It also
        // fades, so under reduced motion (globals.css keeps only opacity, 120ms) it still eases.
        'transition-[translate,opacity,display,overlay] transition-discrete duration-(--duration-medium) ease-slow',
        'translate-x-full opacity-0 open:translate-x-0 open:opacity-100 starting:open:translate-x-full starting:open:opacity-0',
        // The scrim fades with it.
        'backdrop:bg-scrim backdrop:opacity-0 backdrop:transition-[opacity,display,overlay] backdrop:transition-discrete backdrop:duration-(--duration-medium) backdrop:ease-slow',
        'open:backdrop:opacity-100 starting:open:backdrop:opacity-0',
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-hairline pr-2 pl-6">
        <h2 id={titleId} className="sr-only">
          Meniu
        </h2>
        <LogoHorizontal className="h-6 w-auto text-accent-ink" />
        <IconButton onClick={onClose} aria-label="Închide meniul" className="ml-auto">
          <XMarkIcon aria-hidden />
        </IconButton>
      </div>

      <nav
        aria-label="Navigare principală"
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-3',
          signedOut ? 'pb-3' : 'pb-[max(--spacing(4),env(safe-area-inset-bottom))]',
        )}
      >
        <ul className="flex flex-col gap-1">
          {SECTIONS.map(({ key, label, href, Icon }) => linkRow(key, href, label, Icon))}
        </ul>

        {admin.length > 0 || onAdminRetry ? (
          <>
            <div role="separator" className={SEPARATOR} />
            <p id={adminId} className={EYEBROW}>
              Administrare
            </p>
            <ul aria-labelledby={adminId} className="flex flex-col gap-1">
              {admin.map((a) => linkRow(a.key, a.href, a.label, a.Icon, a.caption))}
              {onAdminRetry ? (
                <li>
                  <button
                    type="button"
                    onClick={retrying ? undefined : onAdminRetry}
                    aria-disabled={retrying || undefined}
                    aria-busy={retrying || undefined}
                    className={cn(ROW, 'text-ink hover:bg-soft-fill aria-disabled:cursor-progress aria-disabled:active:opacity-100')}
                  >
                    <ArrowPathIcon className={cn('size-6 shrink-0 text-ink-2', retrying && 'animate-spin')} aria-hidden />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{retrying ? 'Se reîncarcă…' : 'Reîncearcă'}</span>
                      <span className="t-caption truncate text-muted">Nu am putut încărca bălțile tale</span>
                    </span>
                  </button>
                </li>
              ) : null}
            </ul>
          </>
        ) : null}

        {session === 'in' ? (
          <>
            <div role="separator" className={SEPARATOR} />
            <p id={accountId} className={EYEBROW}>
              Contul meu
            </p>
            <ul aria-labelledby={accountId} className="flex flex-col gap-1">
              {ACCOUNT.map(({ key, label, href, Icon }) => linkRow(key, href, label, Icon))}
              {onSignOut ? (
                <>
                  <li role="presentation" aria-hidden className="mx-3 my-2 h-px bg-hairline" />
                  <li>
                    <button
                      type="button"
                      onClick={
                        signingOut
                          ? undefined
                          : () => {
                              onClose();
                              onSignOut();
                            }
                      }
                      aria-disabled={signingOut || undefined}
                      aria-busy={signingOut || undefined}
                      className={cn(ROW, 'text-status-danger-fg hover:bg-soft-fill aria-disabled:cursor-progress aria-disabled:active:opacity-100')}
                    >
                      {signingOut ? (
                        <ArrowPathIcon className="size-6 shrink-0 animate-spin" aria-hidden />
                      ) : (
                        <ArrowRightStartOnRectangleIcon className="size-6 shrink-0" aria-hidden />
                      )}
                      {signingOut ? 'Se închide sesiunea…' : 'Ieși din cont'}
                    </button>
                  </li>
                </>
              ) : null}
            </ul>
          </>
        ) : null}
      </nav>

      {signedOut ? (
        // The one action that matters to a visitor, pinned and emphasised (not a row like the sections).
        <div className="shrink-0 border-t border-hairline px-3 pt-3 pb-[max(--spacing(4),env(safe-area-inset-bottom))]">
          <ButtonLink href={signInHref ?? SIGN_IN_ITEM.href} onClick={onClose} block>
            Intră în cont
          </ButtonLink>
        </div>
      ) : null}
    </dialog>
  );
}
