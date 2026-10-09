'use client';

import type { ReactNode } from 'react';
import { TextInput } from '@/components/forms/TextInput';
import { sanitizePhoneInput } from '@/components/account/profile-form/schema';
import { T4FieldGrid } from '@/components/templates/T4';
import { GUEST_FIELDS, type GuestField, type GuestValues } from './model';

/*
 * «Fără cont» half of «Date pescar» — fish review.tsx:316-354 (c9, c10): «Nume și prenume» and
 * «Număr telefon» (the telephone keypad, which has «+»; the input keeps digits and one leading +, the
 * profile form's sanitizePhoneInput). Leaving the phone field arms the account lookup for that
 * number (`onPhoneBlur`) — never per keystroke. The match banner rides under the pair (`below`).
 * Errors under each field once a submit was refused, then live.
 */

const [NAME, PHONE] = GUEST_FIELDS;

export function GuestContactFields({
  values,
  errors,
  disabled,
  onChange,
  onPhoneBlur,
  below,
}: {
  values: GuestValues;
  errors: Partial<Record<GuestField, string>>;
  disabled: boolean;
  onChange: (field: GuestField, value: string) => void;
  onPhoneBlur: () => void;
  below?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <T4FieldGrid>
        <TextInput
          id={NAME.id}
          label={NAME.label}
          placeholder="Numele pescarului"
          autoComplete="off"
          value={values.contactFullname}
          onChange={(e) => onChange('contactFullname', e.currentTarget.value)}
          error={errors.contactFullname}
          readOnly={disabled}
          data-testid="walkin-contact-name"
        />
        <TextInput
          id={PHONE.id}
          label={PHONE.label}
          placeholder="07XX XXX XXX"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={values.contactPhone}
          onChange={(e) => onChange('contactPhone', sanitizePhoneInput(e.currentTarget.value))}
          onBlur={onPhoneBlur}
          error={errors.contactPhone}
          readOnly={disabled}
          data-testid="walkin-contact-phone"
        />
      </T4FieldGrid>
      {below}
    </div>
  );
}
