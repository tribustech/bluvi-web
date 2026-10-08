'use client';

import { TextInput } from '@/components/forms/TextInput';
import { feeDigits } from './format';

/*
 * organizer.step-basics c10 — «Taxă de înscriere (RON)» (fish step-basics.tsx:421-453): digits
 * only (fish number-pad), validated as you type against createCompetitionSchema (0–50.000: «Taxa de
 * înscriere trebuie să fie între 0 și 50.000 RON.»), auto-saved when the field is left. «RON» is
 * the field's own spaced unit (the kit suffix), never glued to the number.
 */

export function FeeField({
  id,
  value,
  error,
  disabled,
  onChange,
  onBlur,
}: {
  id: string;
  value: string | undefined;
  error: string | undefined;
  disabled: boolean;
  onChange: (next: string) => void;
  onBlur: () => void;
}) {
  return (
    <TextInput
      id={id}
      label="Taxă de înscriere (RON)"
      helper="Suma percepută fiecărui participant la înscriere. Lasă gol sau 0 pentru competiție gratuită."
      error={error}
      placeholder="ex. 150"
      inputMode="numeric"
      autoComplete="off"
      suffix="RON"
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(feeDigits(e.currentTarget.value))}
      onBlur={onBlur}
      data-testid="fee-input"
    />
  );
}
