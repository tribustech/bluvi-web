import { useId, type ComponentProps } from 'react';
import { controlShell, Field, type FieldMessageProps } from '@/components/forms/Field';
import { cn } from '@/components/ui/cn';

type Props = Omit<ComponentProps<'textarea'>, 'children'> &
  FieldMessageProps & {
    /** Shows «12 / 1000» under the field when set (the schema's max). */
    maxLength?: number;
    /**
     * Also sets the native `maxlength` (fish TextInput maxLength): the browser refuses a keystroke
     * or paste past the cap while deleting stays one character at a time — even on a stored value
     * already over it. Off by default (those callers trim in onChange and let the schema refuse).
     */
    capInput?: boolean;
    className?: string;
  };

/**
 * Multi-line field with the kit's label / helper / error stack and control shell (fish TextInput
 * `multiline`, min 100px): «Detalii adiționale», a review's text. Grows with the content up to 240
 * (field-sizing), then scrolls.
 * TODO(kit): promote to components/forms/TextArea.tsx — this task may only touch templates/T4.
 */
export function T4TextArea({ label, helper, error, id, className, disabled, maxLength, capInput = false, value, ...rest }: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const helperId = `${inputId}-help`;
  const count = maxLength !== undefined && typeof value === 'string' ? `${value.length} / ${maxLength}` : null;
  return (
    <Field
      label={label}
      helper={error ? undefined : (helper ?? count)}
      error={error}
      htmlFor={inputId}
      helperId={helperId}
      className={className}
    >
      <div className={cn(controlShell(Boolean(error), disabled), 'h-auto items-stretch py-2.5')}>
        <textarea
          id={inputId}
          disabled={disabled}
          value={value}
          maxLength={capInput ? maxLength : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helper || count ? helperId : undefined}
          className="t-body field-sizing-content max-h-60 min-h-20 min-w-0 flex-1 resize-none bg-transparent text-ink outline-none placeholder:text-muted focus-visible:outline-none disabled:cursor-not-allowed"
          {...rest}
        />
      </div>
    </Field>
  );
}
