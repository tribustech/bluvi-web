'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type Ref } from 'react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { T4TextArea } from '@/components/templates/T4/T4TextArea';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import type { BookingDTO, CancelReasonOption } from '@/core/booking';
import { confirmLabelFor, prefillFor, REASON_LEAD, REASON_PICK_REQUIRED, reasonError } from './model';

export type ReasonDialogProps = {
  /** null: closed. The surface is mounted only while open, so a close resets text, pick and error. */
  booking: BookingDTO | null;
  /**
   * A write is running, this booking's or another's (fish `isPending: !!actingId`): the confirm is
   * busy (spinner, disabled) until it settles, never a dead button.
   */
  pending: boolean;
  /** This booking's write is running: also the pick, the text and «Înapoi» are locked, no close. */
  locked: boolean;
  /** The server's refusal of the last confirm (c11), shown inline until the next edit or submit. */
  refusal?: string | null;
  /** The operator edited the pick or the text: the caller drops `refusal`. */
  onEdit?: () => void;
  onClose: () => void;
  /** The trimmed reason and the picked reason's key (absent on the free-text flow). */
  onConfirm: (reason: string, optionKey?: string) => void;
};

type Copy = {
  title: string;
  confirmLabel: string;
  placeholder: string;
  /** The text field's visible label (fish has only a placeholder; the web names the field). */
  fieldLabel: string;
  /** With a list, a reason must be picked first (the operator's cancel). */
  reasons?: readonly CancelReasonOption[];
  testId: string;
};

/**
 * fish features/bookings/CancelBookingSheet.tsx for the operator's two reason flows (reject, cancel):
 * a sheet on the phone, an alert dialog from 768 (ResponsiveSurface intent «decision»).
 */
export function ReasonDialog({ booking, ...rest }: ReasonDialogProps & Copy) {
  if (!booking) return null;
  return <ReasonSurface key={booking.documentId} {...rest} />;
}

function ReasonSurface({
  pending,
  locked,
  refusal,
  onEdit,
  onClose,
  onConfirm,
  title,
  confirmLabel,
  placeholder,
  fieldLabel,
  reasons,
  testId,
}: Omit<ReasonDialogProps, 'booking'> & Copy) {
  const formId = useId();
  const [text, setText] = useState('');
  const [optionKey, setOptionKey] = useState<string | undefined>(undefined);
  const [touched, setTouched] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLFieldSetElement>(null);
  const refusalRef = useRef<HTMLParagraphElement>(null);

  // The refusal sits under the text, right above the actions: bring it into the scrolling body.
  useEffect(() => {
    if (refusal) refusalRef.current?.scrollIntoView({ block: 'nearest' });
  }, [refusal]);

  const error = reasonError(text, { reasons, optionKey });
  const pickError = touched && error === REASON_PICK_REQUIRED ? error : undefined;
  const textError = touched && error && error !== REASON_PICK_REQUIRED ? error : undefined;

  const close = () => {
    if (!locked) onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setTouched(true);
    if (error) {
      // Take the operator to what is missing: the list (its first row and its error line in view),
      // then the text.
      if (error === REASON_PICK_REQUIRED) {
        const list = listRef.current;
        list?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
        // After the error line renders (this submit sets `touched`).
        requestAnimationFrame(() => list?.scrollIntoView({ block: 'nearest' }));
      } else textRef.current?.focus();
      return;
    }
    onConfirm(text.trim(), optionKey);
  };

  return (
    <ResponsiveSurface
      open
      onClose={close}
      intent="decision"
      title={title}
      // Fit the content (capped at 95dvh, the body scrolls), as fish's dynamic sizing: the cancel's six
      // reasons, the message and the pick error must not open below the fold.
      sheetSnap="fit"
      pinnedActions={!!reasons}
      actions={
        // Phone sheet: one row of two equal buttons (fish BookingActions); the dialog lays them out itself.
        <div className="flex gap-2 md:contents">
          <Button type="button" variant="secondary" onClick={close} disabled={locked} className="max-md:flex-1">
            Înapoi
          </Button>
          <Button
            type="submit"
            variant="dangerOutline"
            form={formId}
            disabled={pending}
            aria-busy={pending || undefined}
            data-testid={`${testId}-confirm`}
            className="max-md:flex-1"
            icon={pending ? <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" /> : undefined}
          >
            {confirmLabelFor(reasons, optionKey, confirmLabel)}
          </Button>
        </div>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="flex flex-col gap-4" data-testid={testId}>
        <p className="t-body text-muted">{REASON_LEAD}</p>
        {reasons ? (
          <ReasonList
            ref={listRef}
            reasons={reasons}
            value={optionKey}
            disabled={locked}
            error={pickError}
            onPick={(option) => {
              setOptionKey(option.key);
              setText(prefillFor(option));
              onEdit?.();
            }}
          />
        ) : null}
        <T4TextArea
          ref={textRef}
          label={fieldLabel}
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onEdit?.();
          }}
          readOnly={locked}
          error={textError}
        />
        {/* The live region exists before the refusal, so its insertion is announced. */}
        <div role="alert" className="empty:-mt-4">
          {refusal ? (
            <p
              ref={refusalRef}
              data-testid={`${testId}-refusal`}
              className="t-body flex items-start gap-2 rounded-control bg-status-danger-bg px-3.5 py-3 text-status-danger-fg"
            >
              <ExclamationCircleIcon className="size-6 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">{refusal}</span>
            </p>
          ) : null}
        </div>
      </form>
    </ResponsiveSurface>
  );
}

/**
 * The required pick (fish CancelBookingSheet `reasons`): one row per reason, a native radio inside
 * each so arrows move and Space picks; selected = accent edge on the accent tint with a filled dot.
 */
function ReasonList({
  ref,
  reasons,
  value,
  disabled,
  error,
  onPick,
}: {
  ref: Ref<HTMLFieldSetElement>;
  reasons: readonly CancelReasonOption[];
  value: string | undefined;
  disabled: boolean;
  error?: string;
  onPick: (option: CancelReasonOption) => void;
}) {
  const name = useId();
  const errorId = `${name}-error`;
  return (
    <fieldset ref={ref} className="flex min-w-0 flex-col gap-2" aria-describedby={error ? errorId : undefined}>
      <legend className="t-label mb-2 text-ink-2">Alege motivul</legend>
      <div className="flex flex-col gap-2">
        {reasons.map((option) => {
          const selected = option.key === value;
          return (
            <label
              key={option.key}
              className={cn(
                // The kit's field language (controlShell): soft fill, a 2px edge that turns accent when picked.
                'flex min-h-12 items-center gap-3 rounded-control border-2 px-3.5 py-2.5 transition-[background-color,border-color] duration-(--duration-fast) ease-fast',
                'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent',
                selected
                  ? 'border-accent bg-accent-tint'
                  : error
                    ? 'border-live bg-status-danger-bg/50'
                    : 'border-transparent bg-soft-fill',
                disabled ? 'cursor-not-allowed opacity-60' : !selected && 'cursor-pointer hover:border-accent-tint-3',
                disabled ? null : selected && 'cursor-pointer'
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.key}
                checked={selected}
                disabled={disabled}
                onChange={() => onPick(option)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  'size-4.5 shrink-0 rounded-full bg-surface',
                  selected ? 'border-[6px] border-accent' : 'border-[1.5px] border-faint'
                )}
              />
              <span className={selected ? 't-body-strong text-accent-ink' : 't-body text-ink'}>{option.label}</span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} className="t-caption text-status-danger-fg">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
