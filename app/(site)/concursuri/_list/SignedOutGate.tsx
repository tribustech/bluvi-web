'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { LockClosedIcon } from '@heroicons/react/20/solid';
import { signInPath } from '@/components/nav/items';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

/*
 * What a signed-out visitor sees in place of live per-user / live-detail blocks (owner, 2026-10-06):
 * the block's real layout, BLURRED, over placeholder data (never real data — the caller passes
 * fake content, e.g. ./placeholders.ts), with one sign-in call to action over it. The blurred copy
 * is decorative (aria-hidden, inert: nothing in it can be focused or clicked); the CTA is the only
 * control and comes back to this page after signing in.
 */

export function SignedOutGate({
  children,
  cta = 'Intră în cont ca să vezi cântăririle live',
  hint,
  className,
}: {
  /** The block drawn over PLACEHOLDER data (never real data). */
  children: ReactNode;
  /** The call to action's label (a link to sign-in that returns here). */
  cta?: string;
  /** One quiet line over the CTA. */
  hint?: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    // min-h: room for the call to action over a short block (a one-row strip).
    <div className={cn('relative isolate min-h-48 overflow-hidden rounded-card', className)}>
      <div aria-hidden inert className="pointer-events-none blur-sm select-none">
        {children}
      </div>
      <div className="absolute inset-0 grid place-items-center bg-page/50 p-4">
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-card bg-surface px-5 py-4 text-center shadow-[var(--shadow-e2),var(--shadow-e0)]">
          <span aria-hidden className="grid size-10 place-items-center rounded-full bg-accent-tint text-accent-ink">
            <LockClosedIcon className="size-5" />
          </span>
          {hint ? <p className="t-body text-ink-2">{hint}</p> : null}
          <Link href={signInPath(pathname)} className={buttonClass({ variant: 'primary' })}>
            {cta}
          </Link>
        </div>
      </div>
    </div>
  );
}
