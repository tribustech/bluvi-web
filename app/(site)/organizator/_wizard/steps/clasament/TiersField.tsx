'use client';

import { useState } from 'react';
import { controlShell } from '@/components/forms/Field';
import { parseTierSizesInput } from '@/core/organizer';
import { tiersOnly } from './model';

const ID = 'clasament-praguri';

/**
 * fish TierSizesEditor (c8): «9,7,5,3» — digits and commas only as typed, validated on blur with
 * core parseTierSizesInput (each of fish's messages); a valid (or emptied) value is written and
 * saved at once (fish onAfterCommit → autoSaveDraft). The error clears as soon as the user types.
 */
export function TiersField({ value, disabled, onCommit }: { value: number[] | undefined; disabled: boolean; onCommit: (tiers: number[] | undefined) => void }) {
  const saved = value ? value.join(',') : '';
  const [text, setText] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  // A value written from elsewhere (hydration, a type change) replaces the text (fish useEffect).
  const [seen, setSeen] = useState(saved);
  if (seen !== saved) {
    setSeen(saved);
    setText(saved);
  }

  const commit = () => {
    const { tiers, error: e } = parseTierSizesInput(text);
    setError(e);
    if (e) return;
    onCommit(tiers ?? undefined);
  };

  const errorId = `${ID}-error`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={ID} className="t-label text-ink-2">
        Numărul de pești pentru calculul calității, descrescător, valori separate prin virgulă.
      </label>
      <div className={controlShell(Boolean(error), disabled)}>
        <input
          id={ID}
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="9,7,5,3"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          disabled={disabled}
          value={text}
          onChange={e => {
            setText(tiersOnly(e.currentTarget.value));
            if (error) setError(null);
          }}
          onBlur={commit}
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
