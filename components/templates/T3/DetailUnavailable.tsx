import type { ReactNode } from 'react';
import { buttonClass, type ButtonVariant } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

/*
 * The T3 «unavailable» treatment — something the app has that the web does not yet (a subpage, a
 * flow). One look everywhere it appears as text (a section action, a route tab, the owner claim):
 *   [label, faint]  [hint, t-micro muted]
 * on one line, baseline-aligned, aria-disabled. The label is faint (an inactive control, apart from
 * the muted links beside it); the hint is muted so it stays readable, and it is always VISIBLE —
 * never only a hover title or sr-only text, there is no hover on a phone.
 *
 * `size`: the label's type step — `label` for section actions (t-label), `tab` for the route tabs
 * (bodyStrong), `body` for a sentence-long action (the owner claim, bodyStrong).
 * `hint`: short where space is tight («în curând» after «Vezi tot», «curând» in a tab).
 *
 * Buttons that are not on the web yet (the booking CTA) are <DetailUnavailableButton>.
 */

const LABEL = { label: 't-label', tab: 't-body-strong', body: 't-body-strong' } as const;

export function DetailUnavailable({
  children,
  hint = 'În curând pe web',
  size = 'label',
  className,
}: {
  children: ReactNode;
  hint?: string;
  size?: keyof typeof LABEL;
  className?: string;
}) {
  return (
    <span aria-disabled="true" className={cn('inline-flex flex-wrap items-baseline gap-x-1.5', className)}>
      <span className={cn(LABEL[size], 'text-faint')}>{children}</span>
      <span className="t-micro text-muted">{hint}</span>
    </span>
  );
}

/**
 * An action that exists but is not on the web yet, drawn as a button: the kit's disabled look
 * (buttonClass `disabled`), yet a real, focusable button (aria-disabled, not `disabled`), so
 * keyboard and screen-reader users reach it and hear why through `aria-describedby` — the hint
 * itself (`hintId`) must be visible next to it.
 * TODO(kit): the kit Button only has the native `disabled` (not focusable). Give components/ui/Button
 * an `unavailable` prop (aria-disabled + this look) and make this a plain <Button unavailable>.
 */
export function DetailUnavailableButton({
  hintId,
  icon,
  block,
  variant = 'primary',
  children,
}: {
  hintId: string;
  icon?: ReactNode;
  block?: boolean;
  variant?: ButtonVariant;
  children: ReactNode;
}) {
  return (
    <button type="button" aria-disabled="true" aria-describedby={hintId} className={buttonClass({ variant, disabled: true, block })}>
      {icon ? (
        <span aria-hidden className="flex size-5 items-center justify-center [&>svg]:size-5">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}
