import { UserIcon } from '@heroicons/react/24/outline';
import { TextInput } from '@/components/forms/TextInput';
import { sanitizePhoneInput } from '@/components/account/profile-form/schema';
import { T4FieldGrid, T4Section, T4TextArea } from '@/components/templates/T4';
import { CONTACT_FIELDS, NOTES_MAX, type ContactField, type ContactValues } from './model';

/*
 * «Date de contact» — fish review.tsx:321-385 (c9–c12): name, phone (digits and one leading + as
 * typed — the phone keypad with +), notes (multi-line). Errors under each field once a «Continuă»
 * was refused, then live (react-hook-form's onSubmit / reValidate onChange).
 * From 1280 (a 900–1300 wide track) name and phone stack on the left and the notes take the right
 * half at their height — not a 1250px textarea under two fields.
 */

const [NAME, PHONE, NOTES] = CONTACT_FIELDS;

export function ContactCard({
  values,
  errors,
  disabled,
  onChange,
}: {
  values: ContactValues;
  errors: Partial<Record<ContactField, string>>;
  disabled: boolean;
  onChange: (field: ContactField, value: string) => void;
}) {
  return (
    <T4Section title="Date de contact" icon={<UserIcon />}>
      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-2 xl:items-start">
        <T4FieldGrid className="xl:grid-cols-1">
          <TextInput
            id={NAME.id}
            label={NAME.label}
            placeholder="Numele tău"
            autoComplete="name"
            value={values.contactFullname}
            onChange={e => onChange('contactFullname', e.currentTarget.value)}
            error={errors.contactFullname}
            readOnly={disabled}
            data-testid="booking-contact-name"
          />
          <TextInput
            id={PHONE.id}
            label={PHONE.label}
            placeholder="07XX XXX XXX"
            // tel, not numeric: the numeric pad has no «+», so a foreign number could not be typed.
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={values.contactPhone}
            onChange={e => onChange('contactPhone', sanitizePhoneInput(e.currentTarget.value))}
            error={errors.contactPhone}
            readOnly={disabled}
            data-testid="booking-contact-phone"
          />
        </T4FieldGrid>
        <T4TextArea
          id={NOTES.id}
          label={NOTES.label}
          placeholder="Detalii adiționale, ora estimată de sosire, etc."
          maxLength={NOTES_MAX}
          value={values.notes ?? ''}
          onChange={e => onChange('notes', e.currentTarget.value)}
          error={errors.notes}
          readOnly={disabled}
          className="[&_textarea]:min-h-25 xl:[&_textarea]:min-h-28"
          data-testid="booking-contact-notes"
        />
      </div>
    </T4Section>
  );
}
