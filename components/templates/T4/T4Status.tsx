import type { ReactNode, Ref } from 'react';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import type { T4SaveState } from './types';

/**
 * Busy glyph: the shell's spinning ArrowPathIcon (TopBar, MobileMenu, T5 DashboardRefresh), in the
 * current colour — one busy look across the product. Only where a 20px icon slot exists (a kit
 * Button's icon slot): Fundații §05 has no 16px glyph, so caption lines say «…» in words instead.
 * Reduced motion stops the spin (globals.css).
 * TODO(kit): promote to components/ui/Spinner.tsx (and switch T2's ring to it) — this task may
 * only touch templates/T4.
 */
export function T4Spinner({ className }: { className?: string }) {
  return <ArrowPathIcon aria-hidden className={cn('size-5 shrink-0 animate-spin', className)} />;
}

/**
 * The autosave line (fish `formatAutoSaveLabel`): «Se salvează…», «Salvat · acum 2 min», a failed
 * save in the warning hue (the words say it failed; colour never carries it alone), or a draft
 * kept on this device only. Text only: the line is a 20px caption, and the system has no 16px
 * glyph (Fundații §05: outline 24, solid 20). Announced politely; one line, truncates. No button
 * in this caption line: a failed save puts its «Reîncearcă» in a <T4Notice tone="warning"> in the
 * step, a full-size target.
 */
export function T4SaveStatus({ state }: { state: T4SaveState }) {
  if (state.kind === 'idle') return null;
  const text =
    state.kind === 'saving'
      ? 'Se salvează…'
      : state.kind === 'saved'
        ? state.label
        : state.kind === 'local'
          ? (state.label ?? 'Ciornă păstrată pe acest dispozitiv')
          : (state.label ?? 'Nu s-a putut salva');
  return (
    <span
      role="status"
      className={cn(
        'min-w-0 truncate',
        state.kind === 'error' ? 'text-status-warning-fg' : 'text-muted',
      )}
    >
      {text}
    </span>
  );
}

export type T4NoticeTone = 'info' | 'warning' | 'danger' | 'success' | 'pending';

const TONE: Record<T4NoticeTone, { box: string; icon: string; glyph: ReactNode }> = {
  info: {
    box: 'bg-surface shadow-e0',
    icon: 'bg-status-info-bg text-status-info-fg',
    glyph: <InformationCircleIcon aria-hidden className="size-6" />,
  },
  pending: {
    box: 'bg-surface shadow-e0',
    icon: 'bg-status-pending-bg text-status-pending-fg',
    glyph: <InformationCircleIcon aria-hidden className="size-6" />,
  },
  warning: {
    box: 'bg-surface shadow-e0',
    icon: 'bg-status-warning-bg text-status-warning-fg',
    glyph: <ExclamationTriangleIcon aria-hidden className="size-6" />,
  },
  danger: {
    box: 'bg-surface shadow-[inset_0_0_0_1px_var(--color-status-danger-line)]',
    icon: 'bg-status-danger-bg text-status-danger-fg',
    glyph: <ExclamationCircleIcon aria-hidden className="size-6" />,
  },
  success: {
    box: 'bg-surface shadow-e0',
    icon: 'bg-status-success-bg text-status-success-fg',
    glyph: <CheckCircleIcon aria-hidden className="size-6" />,
  },
};

type NoticeProps = {
  tone?: T4NoticeTone;
  title: string;
  children?: ReactNode;
  /** Buttons (compact): under the text in a narrow notice, at the right once it is ~672px wide. */
  actions?: ReactNode;
  /** `alert`: announced at once (a refusal, a failed submit). Default: plain content. */
  role?: 'alert' | 'status';
  /** With `tabIndex={-1}`: the screen moves focus here (a failed submit, a refused «Continuă»). */
  ref?: Ref<HTMLDivElement>;
  tabIndex?: number;
  id?: string;
  /** Inside a section card (no second card around it): no surface, ring or padding of its own. */
  inline?: boolean;
  className?: string;
};

/**
 * A notice inside a step: the draft prompt («Ai o ciornă începută»), the request disclaimer
 * («Este o cerere, nu o rezervare confirmată»), a quote refusal, booking turned off. A card like
 * the sections — the same 16 / 20 / 24 padding and 40px disc with a 24px glyph (Fundații §05), so
 * icon and text columns line up through a step. The tinted disc carries the tone (danger =
 * exclamation circle, warning = triangle); colour never carries it alone, the title does.
 *
 * Actions: in-notice recovery is `variant="secondary" size="compact"` (one look for every
 * «Reîncearcă»). The layout follows the notice's OWN width (a container query), not the
 * viewport's: in the 560px form column at 1280 or the 352px summary column the actions stack under
 * the text, each starting on the text column, as on a phone; from ~672px (@2xl) they sit at the
 * right. A ghost action passes `className="-ml-3 @2xl:ml-0"` so its label (not its invisible
 * padding) lines up with the text while stacked.
 */
export function T4Notice({ tone = 'info', title, children, actions, role, ref, tabIndex, id, inline = false, className }: NoticeProps) {
  const t = TONE[tone];
  return (
    <div
      ref={ref}
      id={id}
      tabIndex={tabIndex}
      role={role}
      className={cn(
        '@container scroll-mt-40 rounded-card outline-none focus-visible:outline-2 focus-visible:outline-accent xl:scroll-mt-24',
        inline ? 'focus-visible:outline-offset-4' : cn('p-4 md:p-5 xl:p-6', t.box),
        className,
      )}
    >
      <div className="flex flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', t.icon)}>{t.glyph}</span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="t-body-strong text-ink">{title}</p>
            {children ? <div className="t-caption text-muted">{children}</div> : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-col items-start gap-2 pl-13 @2xl:flex-row @2xl:items-center @2xl:pl-0">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
