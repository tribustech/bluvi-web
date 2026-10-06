'use client';

import { useId, type ReactNode, type Ref } from 'react';
import { MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { controlShell, Field } from '@/components/forms/Field';
import { iconButtonClass } from '@/components/nav/IconButton';
import { cn } from '@/components/ui/cn';
import { RING_DANGER, RING_SELECTED_CHECKED } from '../rings';

/*
 * Big-target inputs for a task done standing up, often with wet hands: every target is ≥ 48px
 * (40 from 1280, like every kit control), the value being entered is the biggest thing on the
 * screen, and errors sit right under it. All three compose the kit's <Field> and controlShell(),
 * so label, helper, error, focus ring and radius are the form kit's own.
 */

type BigNumberInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** «kg», «buc», «lei». */
  unit: string;
  placeholder?: string;
  helper?: ReactNode;
  error?: ReactNode;
  /** decimal (comma or dot) or whole numbers. */
  mode?: 'decimal' | 'numeric';
  name?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  ref?: Ref<HTMLInputElement>;
};

/**
 * The value of the task, typed big (64px digits, the signature-number step): the weight on the
 * scale, the code to join. Numeric keypad on a phone (`inputMode`), comma or dot accepted. The
 * unit follows the digits (an invisible copy of the value measures them), so «4,250 kg» reads as
 * one number at any field width; the whole field stays the click target.
 */
export function BigNumberInput({
  label,
  value,
  onChange,
  unit,
  placeholder = '0,000',
  helper,
  error,
  mode = 'decimal',
  name,
  autoFocus,
  disabled,
  ref,
}: BigNumberInputProps) {
  const id = useId();
  const helpId = `${id}-help`;
  return (
    <Field label={label} helper={helper} error={error} htmlFor={id} helperId={helpId}>
      {/* min-h over the shell's h-11: cn() does not merge, and min-height wins over height. */}
      <div className={cn(controlShell(Boolean(error), disabled), 'relative min-h-24')}>
        <input
          ref={ref}
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode={mode}
          autoComplete="off"
          enterKeyHint="done"
          placeholder={placeholder}
          // Focus on open is the point of a one-task screen (fish opens the sheet on the field).
          autoFocus={autoFocus}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helper ? helpId : undefined}
          className="t-num-64 h-16 min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-faint focus-visible:outline-none disabled:cursor-not-allowed"
        />
        <span aria-hidden aria-disabled={disabled || undefined} className="pointer-events-none absolute inset-0 flex items-center overflow-hidden px-3">
          {/* SignatureNumber's `tile` pairing (64px digits, then a space and the unit in t-heading), so «kg»
              here has the same weight against its digits as every other 64px number. */}
          <span className="inline-flex min-w-0 items-baseline">
            <span className="t-num-64 invisible whitespace-pre">{value || placeholder}</span>
            <span className="t-heading shrink-0 whitespace-pre text-muted">{`\u00a0${unit}`}</span>
          </span>
        </span>
      </div>
    </Field>
  );
}

type QuantityStepperProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  unit?: string;
  error?: ReactNode;
  name?: string;
  disabled?: boolean;
  /**
   * Extra classes on the field shell — e.g. `md:min-h-24` when it sits beside a BigNumberInput, so
   * both fields share one height and their helper lines one baseline. −/+ stay centred.
   */
  shellClassName?: string;
};

/**
 * − value + (fish: a number field «buc», max 20). The −/+ are the shell's icon buttons (48 / 40
 * from 1280) as white keys on the soft-fill field (surface + the e0 hairline, the resting control
 * of Fundații §04 — e1 is for photo cards); hover is the kit's soft-fill. At a limit the key keeps
 * its surface and only its glyph fades to faint, so − and + stay one pair. Value and unit sit
 * centred together between them. A real
 * number input in the middle, so the keyboard and the arrow keys work too; it holds whole numbers
 * only (step 1, a typed fraction is truncated).
 */
export function QuantityStepper({
  label,
  value,
  onChange,
  min = 1,
  max = 99,
  unit,
  error,
  name,
  disabled,
  shellClassName,
}: QuantityStepperProps) {
  const id = useId();
  const helpId = `${id}-help`;
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const btn = iconButtonClass({
    className:
      'bg-surface shadow-e0 disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-surface disabled:hover:text-faint disabled:active:opacity-100',
  });
  const digits = Math.max(1, Number.isFinite(value) ? String(value).length : 1);
  return (
    <Field label={label} error={error} htmlFor={id} helperId={helpId}>
      <div className={cn(controlShell(Boolean(error), disabled), 'min-h-16', shellClassName)}>
        <button
          type="button"
          className={btn}
          onClick={() => onChange(clamp(value - 1))}
          disabled={disabled || value <= min}
          aria-label="Mai puțin"
        >
          <MinusIcon aria-hidden />
        </button>
        <span className="flex min-w-0 flex-1 items-baseline justify-center gap-1">
          <input
            id={id}
            name={name}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={1}
            value={Number.isFinite(value) ? value : ''}
            // A count of fish: whole numbers only — «1.5» or «2,7» never becomes the quantity.
            onChange={(e) => onChange(e.target.value === '' ? Number.NaN : Math.trunc(Number(e.target.value)))}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? helpId : undefined}
            // Sized to its digits (+1ch for the caret) so «buc» follows the number.
            style={{ width: `${digits + 1}ch` }}
            className="t-num-26 h-12 min-w-0 appearance-none bg-transparent text-right text-ink outline-none [-moz-appearance:textfield] focus-visible:outline-none disabled:cursor-not-allowed [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          {unit ? (
            <span aria-hidden aria-disabled={disabled || undefined} className="t-body-strong text-muted">
              {unit}
            </span>
          ) : null}
        </span>
        <button
          type="button"
          className={btn}
          onClick={() => onChange(clamp((Number.isFinite(value) ? value : min - 1) + 1))}
          disabled={disabled || value >= max}
          aria-label="Mai mult"
        >
          <PlusIcon aria-hidden />
        </button>
      </div>
    </Field>
  );
}

type ChoiceChipsProps<V extends string> = {
  label: string;
  name: string;
  options: { value: V; label: string }[];
  value: V | '';
  onChange: (value: V) => void;
  error?: ReactNode;
  disabled?: boolean;
};

/**
 * One-of-many as chips, 48 / 40 from 1280 like the kit buttons. The system's single-choice
 * treatment (T1 option pills, T4ChoiceCard): surface + e0 at rest, soft-fill on hover; picked =
 * accent-tint, accent-ink text and a 2px inset accent ring. Native radios, so arrows move the
 * choice and the group has one tab stop; `disabled` turns the whole fieldset off.
 *
 * The error is wired on every radio (aria-describedby; aria-invalid on the radiogroup), because a screen reader
 * does not read the fieldset's description when focus lands on a radio inside it. A radio the
 * screen focuses after a failed submit gets `data-focus-ring` (removed on blur), so the ring
 * shows even when that submit was a mouse click (no :focus-visible then).
 */
export function ChoiceChips<V extends string>({ label, name, options, value, onChange, error, disabled }: ChoiceChipsProps<V>) {
  const helpId = useId();
  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-1.5">
      <legend className="t-label mb-1.5 text-ink-2">{label}</legend>
      {/* aria-invalid lives on the radiogroup (ARIA has no invalid radio); the error itself is
          also on every radio's description, read when one takes focus. */}
      <div role="radiogroup" aria-label={label} aria-invalid={error ? true : undefined} className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              't-body-strong flex h-12 items-center rounded-control bg-surface px-4 text-ink transition-[background-color,color,box-shadow] duration-(--duration-fast) ease-select xl:h-10',
              error ? RING_DANGER : 'shadow-e0',
              'has-checked:bg-accent-tint has-checked:text-accent-ink', RING_SELECTED_CHECKED,
              'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent',
              'has-[[data-focus-ring]:focus]:outline-2 has-[[data-focus-ring]:focus]:outline-offset-2 has-[[data-focus-ring]:focus]:outline-accent',
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-soft-fill has-checked:hover:bg-accent-tint',
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              onBlur={(e) => {
                delete e.currentTarget.dataset.focusRing;
              }}
              aria-describedby={error ? helpId : undefined}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
      {error ? (
        <p id={helpId} role="alert" className="t-caption text-status-danger-fg">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
