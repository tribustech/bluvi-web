import type { ReactNode } from 'react';
import { ArrowRightEndOnRectangleIcon } from '@heroicons/react/24/outline';
import { signInPath } from '@/components/nav/items';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { STATE_CARD_FRAME } from './stateCard';

/**
 * THE signed-out gate of every template — the one sign-in moment stateCard.ts promises, drawn once:
 * T1 (ListSignInGate), T4 / T6 (a flow that needs an account), T5 (DashboardSignedOut) all render
 * this, so the moment looks the same on every page. Anatomy, fixed:
 * - a 56px accent-tint disc with the 24 outline glyph (default: «enter», the top bar's «Intră» icon;
 *   a flow may put its subject's glyph in the same slot — the cântar's scale);
 * - the title at t-title2 (the system's state-card title step), the description at t-body;
 * - the primary «Intră în cont» (returns to `next`) and an optional secondary way on («Înapoi la
 *   baltă»), side by side from 768, stacked full width on a phone;
 * - the frame: STATE_CARD_FRAME (720 at most, centred in the column at every width).
 *
 * TODO(kit): lives in components/templates until it moves to components/surfaces (with
 * `routes.signIn(next)` in lib/routes.ts); signInPath() in nav/items.ts stands in for the helper.
 */
export function SignInGate({
  title,
  description,
  next,
  href,
  cta = 'Intră în cont',
  secondaryAction,
  icon,
  headingLevel = 2,
  className,
}: {
  title: string;
  description?: ReactNode;
  /** The page to come back to after sign-in (a path with its query). */
  next?: string;
  /** A ready sign-in URL instead of `next` (already carrying its own `?next=`). */
  href?: string;
  cta?: string;
  /** A secondary ButtonLink / Button: the public way on. */
  secondaryAction?: ReactNode;
  /** The 24 outline glyph of the disc. Default: enter. */
  icon?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  return (
    <div
      className={cn(
        STATE_CARD_FRAME,
        'flex flex-col items-center gap-3 rounded-card bg-surface px-5 py-8 text-center shadow-e0 md:px-8 md:py-12',
        className,
      )}
    >
      <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-accent-tint text-accent-ink [&>svg]:size-6">
        {icon ?? <ArrowRightEndOnRectangleIcon />}
      </span>
      <Heading className="t-title2 text-ink">{title}</Heading>
      {description ? <div className="max-w-120 t-body text-ink-2">{description}</div> : null}
      <div className="mt-2 flex w-full flex-col gap-2.5 md:w-auto md:flex-row md:justify-center">
        <ButtonLink href={href ?? signInPath(next)}>{cta}</ButtonLink>
        {secondaryAction}
      </div>
    </div>
  );
}
