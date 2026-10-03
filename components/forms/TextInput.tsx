import { useId, type ComponentProps, type ReactNode } from 'react';
import { controlShell, Field, type FieldMessageProps } from './Field';

export type TextInputProps = Omit<ComponentProps<'input'>, 'children'> &
  FieldMessageProps & {
    /** Unit shown inside the field, right-aligned (e.g. «RON», «kg»). */
    suffix?: ReactNode;
    className?: string;
  };

/** Text field with label, helper and error states (Fundații §07 «Formulare»). */
export function TextInput({ label, helper, error, suffix, id, className, disabled, ...input }: TextInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const helperId = `${inputId}-help`;
  return (
    <Field label={label} helper={helper} error={error} htmlFor={inputId} helperId={helperId} className={className}>
      <div className={controlShell(Boolean(error), disabled)}>
        <input
          id={inputId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helper ? helperId : undefined}
          className="t-body h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted focus-visible:outline-none disabled:cursor-not-allowed"
          {...input}
        />
        {suffix ? (
          <span aria-hidden className="t-body-strong shrink-0 text-muted">
            {suffix}
          </span>
        ) : null}
      </div>
    </Field>
  );
}

/** Money amount in lei: numeric keyboard, «RON» suffix (e.g. «Taxă de participare»). */
export function MoneyInput(props: Omit<TextInputProps, 'suffix' | 'inputMode'>) {
  return <TextInput inputMode="decimal" autoComplete="off" suffix="RON" {...props} />;
}
