'use client';

import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { FOCUS_RING } from '@/components/templates/T1';
import { FishLogo } from '@/components/nav/brand';
import { cn } from '@/components/ui/cn';
import type { NotificationResponse } from '@/core/social';
import { formatNotificationTime } from './format';
import { ROW_CARD } from './styles';

/** Hover / press / focus of a row with a page (a link). Hover differs from rest in both states. */
const ROW_LINK = cn(
  'w-full text-left transition-[background-color,opacity] duration-(--duration-fast) ease-fast active:opacity-80',
  FOCUS_RING,
);
/** Hover per state: a read row greys, an unread one takes the accent tint (≠ its white rest, ≠ a read row). */
const HOVER_READ = 'hover:bg-soft-fill';
const HOVER_UNREAD = 'hover:bg-accent-tint';

/**
 * An unread row with no page on the web: a button that only marks it read (c8/c9). fish gives such a
 * row no press feedback (pressStyle opacity 1 without a redirectUrl): no hover, no press fade — only
 * the keyboard focus ring.
 */
const ROW_INERT_BUTTON = cn('w-full cursor-default text-left', FOCUS_RING);

/**
 * One notification (account.notifications.c6–c9). fish: the Bluvi fish mark, the title (bold when
 * unread) with an accent dot, the body, the sent time; read rows at 60% opacity.
 *
 * Unread: a white card with its hairline, the title in ink at the strong weight, the body in ink-2
 * and fish's accent dot right of the title — at every width (no background wash: hover stays legible).
 * Read: quieter without opacity (60% took the body below AA) — the title in ink-2 at the body weight,
 * the body and time in muted, the mark faded, and from 768 a flat card (no hairline).
 *
 * With a page on the web (`href`) the row is a link: activating it calls `onOpen` (mark read when
 * unread, analytics) and navigates. Without one, an UNREAD row is a button that only calls `onOpen`
 * (fish handleNotificationPress marks it read and logs it even when there is nowhere to go: c8/c9),
 * and a read row is plain text — no hover, no press, no focus stop — so it is never a dead link.
 */
export function NotificationRow({
  notification,
  href,
  onOpen,
  now,
}: {
  notification: NotificationResponse;
  href: string | null;
  onOpen?: () => void;
  now?: Date;
}) {
  const { read } = notification;
  const { title, body, sentAt } = notification.notification;

  // A button row turns plain text once it is read: keep a keyboard user's place on the row.
  const plain = useRef<HTMLDivElement>(null);
  const refocus = useRef(false);
  useEffect(() => {
    if (!read || !refocus.current) return;
    refocus.current = false;
    const lost = !document.activeElement || document.activeElement === document.body;
    if (lost) plain.current?.focus();
  }, [read]);

  const content: ReactNode = (
    <>
      <span
        aria-hidden
        className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-ink md:size-12"
      >
        <FishLogo className={cn('size-8 md:size-9', read && 'opacity-50')} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-start gap-2">
          <span className={cn('min-w-0 flex-1 break-words', read ? 't-body text-ink-2' : 't-body-strong text-ink')}>{title}</span>
          {read ? null : (
            <>
              <span data-unread-dot aria-hidden className="mt-1.5 size-3 shrink-0 rounded-full bg-accent" />
              <span className="sr-only">necitită</span>
            </>
          )}
        </span>
        <span className={cn('t-body break-words', read ? 'text-muted' : 'text-ink-2')}>{body}</span>
        <time dateTime={sentAt} className="t-caption text-muted">
          {formatNotificationTime(sentAt, now)}
        </time>
      </span>
      {/* The chevron's column is kept on rows without a page too, so every dot sits on one line. */}
      {href ? <ChevronRightIcon aria-hidden className="size-5 shrink-0 self-center text-muted" /> : <span aria-hidden className="w-5 shrink-0" />}
    </>
  );

  const card = cn(ROW_CARD, read && 'md:shadow-none');

  return (
    <li data-read={read || undefined}>
      {href ? (
        <Link href={href} prefetch={false} onClick={onOpen} className={cn(card, ROW_LINK, read ? HOVER_READ : HOVER_UNREAD)}>
          {content}
        </Link>
      ) : !read ? (
        <button
          type="button"
          onClick={() => {
            refocus.current = true;
            onOpen?.();
          }}
          className={cn(card, ROW_INERT_BUTTON)}
        >
          {content}
        </button>
      ) : (
        <div ref={plain} tabIndex={-1} className={cn(card, 'outline-none')}>
          {content}
        </div>
      )}
    </li>
  );
}
