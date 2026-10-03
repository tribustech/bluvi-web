import { useId } from 'react';
import { cn } from '@/components/ui/cn';

export type SegmentOption<V extends string> = { value: V; label: string };

type Props<V extends string> = {
  label: string;
  name: string;
  options: SegmentOption<V>[];
  /** Uncontrolled initial value… */
  defaultValue?: V;
  /** …or controlled. */
  value?: V;
  onChange?: (value: V) => void;
  helper?: string;
  className?: string;
};

/**
 * Two-to-four way choice («Tip»: Individual / Echipe). Native radios, so it works in a plain
 * <form> without JS and the arrow keys move the selection; the selected segment is a raised
 * surface on the soft-fill track.
 */
export function SegmentedControl<V extends string>({
  label,
  name,
  options,
  defaultValue,
  value,
  onChange,
  helper,
  className,
}: Props<V>) {
  const helpId = useId();
  return (
    <fieldset className={cn('flex min-w-0 flex-col gap-1.5', className)} aria-describedby={helper ? helpId : undefined}>
      <legend className="t-label mb-1.5 text-ink-2">{label}</legend>
      <div
        className="grid h-11 rounded-control bg-soft-fill p-[3px]"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              'flex cursor-pointer items-center justify-center t-control rounded-[calc(var(--radius-control)-3px)] text-ink-2 transition-[background-color,color,box-shadow] duration-(--duration-fast) ease-select',
              'has-checked:bg-surface has-checked:text-ink has-checked:shadow-e1',
              'has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-accent',
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              className="sr-only"
              {...(value !== undefined
                ? { checked: value === o.value, onChange: () => onChange?.(o.value) }
                : { defaultChecked: defaultValue === o.value })}
            />
            {o.label}
          </label>
        ))}
      </div>
      {helper ? (
        <p id={helpId} className="t-caption text-muted">
          {helper}
        </p>
      ) : null}
    </fieldset>
  );
}
