'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { headerChipClass } from '@/components/templates/T3/DetailHeader';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

type Outcome = 'idle' | 'pending' | 'done' | 'failed';

const STATUS: Record<Outcome, string> = {
  idle: '',
  pending: 'Se actualizează…',
  done: 'Actualizat',
  failed: 'Nu s-a putut actualiza',
};

/**
 * What `onRefresh` resolves to: true / nothing = refreshed; false (or a throw) = failed, said here;
 * 'reported' = the caller already told the user (a toast, a redirect), so this stays quiet — one
 * failure is announced once.
 */
export type RefreshResult = boolean | void | 'reported';

/**
 * The web stand-in for fish pull-to-refresh. `onRefresh` refetches the page's client queries and
 * keeps the figures on screen (a failed refetch with data keeps the data); without it the server
 * page is re-rendered (router.refresh — only for a page with nothing on screen yet). A server
 * re-render can't report its own outcome, so that path claims nothing: the page it renders (data,
 * or an error card that announces itself) is the answer.
 *
 * icon: the header control — a 48px soft-fill chip below 768 (the back button's twin, T3
 *   headerChipClass, on the header's surface band), a quiet labelled ghost Button from 768 (the
 *   alert keeps the accent). Its glyph is the 24px outline at its own size in both (Fundații §05:
 *   outlines are never scaled), so it is not passed to the Button's 20px `icon` slot.
 *   TODO(kit): a Button `iconSize="24"` for outline glyphs (this task may only touch T5).
 * button: a labelled secondary Button (48 / 40 from 1280, the kit default).
 *
 * While pending the control stays focusable (aria-disabled, clicks ignored), so keyboard and
 * screen-reader users keep their place; the outcome is announced in a polite live region.
 */
export function DashboardRefresh({
  onRefresh,
  label = 'Reîmprospătează',
  variant = 'icon',
}: {
  onRefresh?: () => Promise<RefreshResult> | RefreshResult;
  label?: string;
  variant?: 'icon' | 'button';
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [outcome, setOutcome] = useState<Outcome>('idle');
  const pending = outcome === 'pending';

  const run = () => {
    if (pending) return;
    setOutcome('pending');
    start(async () => {
      try {
        if (onRefresh) {
          const r = await onRefresh();
          setOutcome(r === false ? 'failed' : r === 'reported' ? 'idle' : 'done');
        } else {
          router.refresh();
          setOutcome('idle');
        }
      } catch {
        setOutcome('failed');
      }
    });
  };

  const status = (
    <span role="status" className="sr-only">
      {STATUS[outcome]}
    </span>
  );

  if (variant === 'button') {
    return (
      <>
        <Button variant="secondary" onClick={run} aria-disabled={pending || undefined} aria-busy={pending || undefined}>
          {pending ? 'Se încarcă…' : label}
        </Button>
        {status}
      </>
    );
  }

  const icon = <ArrowPathIcon aria-hidden className={cn(pending && 'animate-spin motion-reduce:animate-none')} />;
  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={run}
        aria-disabled={pending || undefined}
        className={headerChipClass({ className: 'md:hidden' })}
      >
        {icon}
      </button>
      <Button variant="ghost" onClick={run} aria-disabled={pending || undefined} className="max-md:hidden">
        <span aria-hidden className="flex size-6 items-center justify-center [&>svg]:size-6">
          {icon}
        </span>
        {/* The label stays put (no width jump); the spinning icon and the live region say it runs. */}
        {label}
      </Button>
      {status}
    </>
  );
}
