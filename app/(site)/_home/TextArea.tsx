import { useId, type ComponentProps } from 'react';
import { controlShell, Field, type FieldMessageProps } from '@/components/forms/Field';
import { cn } from '@/components/ui/cn';

/**
 * Multi-line field on the kit's Field + control shell (the kit has no textarea yet — kit gap).
 * The shell's fixed 44px height is lifted; everything else (states, ring) is the kit's.
 */
export function TextArea({ label, helper, error, id, className, ...area }: Omit<ComponentProps<'textarea'>, 'children'> & FieldMessageProps) {
  const autoId = useId();
  const areaId = id ?? autoId;
  const helperId = `${areaId}-help`;
  return (
    <Field label={label} helper={helper} error={error} htmlFor={areaId} helperId={helperId} className={className}>
      <div className={cn(controlShell(Boolean(error), area.disabled).replace('h-11', 'h-auto').replace('items-center', 'items-stretch'), 'py-2.5')}>
        <textarea
          id={areaId}
          rows={5}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helper ? helperId : undefined}
          className="min-h-28 w-full resize-y bg-transparent t-body text-ink outline-none placeholder:text-muted focus-visible:outline-none"
          {...area}
        />
      </div>
    </Field>
  );
}
