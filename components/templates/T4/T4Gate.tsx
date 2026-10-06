'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { STATE_CARD_FRAME } from '../stateCard';
import { RING_DANGER } from '../rings';

type Props = {
  /** 24px outline icon (rendered at the kit's 24), in a 56px tinted disc. */
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  /** The way forward: «Intră în cont», «Înapoi la baltă», «Reîncearcă» (the system's one retry label). */
  actions?: ReactNode;
  /** Between the text and the actions: what an outcome was about (a recap of the booking sent). */
  children?: ReactNode;
  /** danger: the flow cannot run at all. success: the flow is finished (sent, published). */
  tone?: 'accent' | 'danger' | 'success';
  /**
   * The gate replaced the step after the user acted (sent → «Cererea a fost trimisă»): its title
   * takes focus on mount, so the outcome is announced and the keyboard lands on it instead of
   * falling to <body>.
   */
  focusOnMount?: boolean;
  /** `alert` for a failure, `status` for an outcome. Default: plain content. */
  role?: 'alert' | 'status';
  /**
   * `start` (inside a T4Frame): left-aligned content on the T4 card scale (16 / 20 / 24), filling
   * the form column like the step's sections. `center`: centred content, capped at 560, for a
   * column that centres the card itself (T6 FlowLayout).
   */
  align?: 'start' | 'center';
  /**
   * With `align="start"` in a frame without a rail: the card is indented so its CONTENT column
   * (disc, title, actions) — not its border — sits on the header title's left edge (T4_TITLE_INDENT
   * minus the card padding: 60 − 20 from 768, 56 − 24 from 1280). A phone keeps the card on the
   * gutter, like every section card (an indented card would lose 44px of a 343px column).
   * `below-xl`: the frame has a rail from 1280 (the form column already starts right of it), so
   * the indent stops there.
   */
  indent?: boolean | 'below-xl';
  className?: string;
};

/**
 * Every «the flow cannot run here» block and every outcome, in one anatomy (56px disc, title2,
 * body, actions): no right to run it, nothing to book (booking off, no availability), the data could not be read (`tone="danger"`,
 * `role="alert"`, with a retry), already done (sent). Takes the place of the step content inside
 * the frame, so the header still says where the user is. In-step problems (a refused price, a
 * failed submit) are <T4Notice>s with the 40px disc, never gates. T6 uses the same gate. Signed out
 * is NOT a T4Gate: every template renders the one <SignInGate> (../SignInGate.tsx).
 *
 * `align="start"` + `indent` puts the content on the header title's left edge rather than leaving
 * centred text in a left-anchored box.
 */
/**
 * The header's title column (back chip 48 + gap 12 below 1280, 40 + 16 from 1280; the page gutter
 * is shared) minus the card padding: the gate's content starts where the h1 does.
 */
const GATE_INDENT = 'md:ml-10 xl:ml-8';

export function T4Gate({
  icon,
  title,
  description,
  actions,
  children,
  tone = 'accent',
  focusOnMount = false,
  role,
  align = 'center',
  indent = false,
  className,
}: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount) heading.current?.focus({ preventScroll: true });
    // Mount only: the gate is the outcome, focus it once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      role={role}
      className={cn(
        'flex flex-col gap-3 rounded-card bg-surface',
        align === 'start'
          ? cn('items-start p-4 text-left md:p-5 xl:p-6', indent === true && GATE_INDENT, indent === 'below-xl' && 'md:ml-10 xl:ml-0')
          : cn(STATE_CARD_FRAME, 'items-center px-5 py-8 text-center md:px-8 md:py-12'),
        tone === 'danger' ? RING_DANGER : 'shadow-e0',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-14 items-center justify-center rounded-full [&>svg]:size-6',
          tone === 'danger'
            ? 'bg-status-danger-bg text-status-danger-fg'
            : tone === 'success'
              ? 'bg-status-success-bg text-status-success-fg'
              : 'bg-accent-tint text-accent-ink',
        )}
      >
        {icon}
      </span>
      <h2 ref={heading} tabIndex={focusOnMount ? -1 : undefined} className="t-title2 text-ink outline-none">
        {title}
      </h2>
      {description ? <div className="t-body max-w-100 text-muted">{description}</div> : null}
      {children}
      {actions ? <div className="mt-2 flex w-full flex-col gap-2.5 md:w-auto md:flex-row">{actions}</div> : null}
    </div>
  );
}
