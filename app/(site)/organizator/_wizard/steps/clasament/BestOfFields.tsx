'use client';

import { controlShell } from '@/components/forms/Field';
import { digitsOnly } from './model';

type Field = 'bestOfFishCount' | 'numberOfWinners';

/**
 * fish «Parametri Best Of» (c10): «Număr de pești pentru clasament» (1–100) and «Număr de
 * câștigători» (≥ 1). Digits only; validated on every keystroke with the schema's messages (fish
 * trigger); saved on blur (fish onBlur → autoSaveDraft).
 */
export function BestOfFields({
  values,
  errors,
  disabled,
  onChange,
  onBlur,
}: {
  values: Record<Field, string | undefined>;
  errors: Partial<Record<Field, string>>;
  disabled: boolean;
  onChange: (field: Field, value: string) => void;
  onBlur: (field: Field) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-3">
      <CountField id="clasament-best-of-pesti" field="bestOfFishCount" label="Număr de pești pentru clasament" {...{ values, errors, disabled, onChange, onBlur }} />
      <CountField id="clasament-best-of-castigatori" field="numberOfWinners" label="Număr de câștigători" {...{ values, errors, disabled, onChange, onBlur }} />
    </div>
  );
}

function CountField({
  id,
  field,
  label,
  values,
  errors,
  disabled,
  onChange,
  onBlur,
}: {
  id: string;
  field: Field;
  label: string;
  values: Record<Field, string | undefined>;
  errors: Partial<Record<Field, string>>;
  disabled: boolean;
  onChange: (field: Field, value: string) => void;
  onBlur: (field: Field) => void;
}) {
  const error = errors[field];
  const errorId = `${id}-error`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="t-label text-ink-2">
        {label}
      </label>
      <div className={controlShell(Boolean(error), disabled)}>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          disabled={disabled}
          value={values[field] ?? ''}
          onChange={e => onChange(field, digitsOnly(e.currentTarget.value))}
          onBlur={() => onBlur(field)}
          className="t-body h-full min-w-0 flex-1 bg-transparent text-ink outline-none tabular-nums placeholder:text-muted focus-visible:outline-none disabled:cursor-not-allowed"
        />
      </div>
      {error ? (
        <p id={errorId} role="alert" className="t-caption text-status-danger-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}
