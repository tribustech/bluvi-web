'use client';

import { useId, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { ROW_HELPER, ROW_ICON, ROW_LINE, ROW_PAD_X } from './styles';

/**
 * The bare switch: a native checkbox with role=switch (Space toggles; Enter too, as fish's tap), a
 * 48×28 track with a 22px thumb. Off is the neutral muted track (4.9:1 on surface, past the 3:1
 * non-text minimum), on is accent — the same control as T1 FilterSwitch.
 * TODO(kit): FilterSwitch carries the same look inline; both move to components/forms/Switch.tsx.
 */
export function SettingsSwitch({
  id,
  checked,
  onChange,
  disabled = false,
  busy = false,
  describedBy,
  labelledBy,
}: {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** A save in flight (aria-busy): the switch already shows the new value (optimistic); it stays focusable, and the screen decides what a change does meanwhile (notification settings: ignored). */
  busy?: boolean;
  describedBy?: string;
  labelledBy?: string;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-busy={busy || undefined}
        aria-describedby={describedBy}
        aria-labelledby={labelledBy}
        onChange={(e) => onChange(e.target.checked)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          e.currentTarget.click();
        }}
        className={cn(
          'peer h-7 w-12 cursor-pointer appearance-none rounded-full bg-muted transition-colors duration-(--duration-fast) ease-fast checked:bg-accent',
          'disabled:cursor-default disabled:bg-faint',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent',
        )}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-0.75 left-0.75 size-5.5 rounded-full bg-surface transition-[translate] duration-(--duration-fast) ease-select peer-checked:translate-x-5"
      />
    </span>
  );
}

/**
 * fish NotificationCardItem (+ the helper Typography under it): icon · label · switch, and an
 * optional helper line. The label is a <label> for the switch (a click on it toggles, as on any
 * form), the helper is the switch's description. The switch is controlled: the screen owns the
 * value and the save (fish wires useToggleNotifications inside the row; here the row is generic).
 */
export function SwitchRow({
  icon,
  label,
  helper,
  checked,
  onChange,
  disabled = false,
  busy = false,
}: {
  icon?: ReactNode;
  label: string;
  helper?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const id = useId();
  const helperId = useId();
  return (
    <div className={ROW_PAD_X}>
      <div className={ROW_LINE}>
        {icon ? (
          <span aria-hidden className={ROW_ICON}>
            {icon}
          </span>
        ) : null}
        <label htmlFor={id} className={cn('t-body-strong min-w-0 flex-1 self-stretch content-center', disabled ? 'cursor-default text-faint' : 'cursor-pointer text-ink')}>
          {label}
        </label>
        <SettingsSwitch id={id} checked={checked} onChange={onChange} disabled={disabled} busy={busy} describedBy={helper ? helperId : undefined} />
      </div>
      {helper ? (
        <p id={helperId} className={ROW_HELPER}>
          {helper}
        </p>
      ) : null}
    </div>
  );
}
