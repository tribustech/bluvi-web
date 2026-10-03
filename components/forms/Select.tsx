import { useId, type ComponentProps } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { controlShell, Field, type FieldMessageProps } from './Field';

export type SelectOption = { value: string; label: string };

type Props = Omit<ComponentProps<'select'>, 'children'> &
  FieldMessageProps & {
    options: SelectOption[];
    /** Disabled first option shown while nothing is chosen. */
    placeholder?: string;
    className?: string;
  };

/** Native select styled as a field — for longer lists where a segmented control does not fit. */
export function Select({ label, helper, error, options, placeholder, id, className, disabled, ...select }: Props) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const helperId = `${selectId}-help`;
  return (
    <Field label={label} helper={helper} error={error} htmlFor={selectId} helperId={helperId} className={className}>
      <div className={`${controlShell(Boolean(error), disabled)} relative`}>
        <select
          id={selectId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helper ? helperId : undefined}
          className="t-body h-full min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-7 text-ink outline-none focus-visible:outline-none disabled:cursor-not-allowed"
          {...select}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon aria-hidden className="pointer-events-none absolute right-3 size-5 text-muted" />
      </div>
    </Field>
  );
}
