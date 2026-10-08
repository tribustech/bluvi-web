'use client';

import { useRef, useState, type ChangeEvent, type ClipboardEvent, type CompositionEvent, type Ref } from 'react';
import { cn } from '@/components/ui/cn';
import { CODE_LENGTH, cleanCode, codeFromPaste } from './code';

type Props = {
  id: string;
  value: string;
  onChange: (code: string) => void;
  /** The helper line (and the inline error, when there is one) the field is described by. */
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  ref?: Ref<HTMLInputElement>;
};

/**
 * The join code (fish join/index.tsx TextInput): ONE input, centred, placeholder «COD», 800-weight
 * capitals spaced like a code (fish letterSpacing 8 at 28px) — the biggest thing on the screen.
 * Typing is cleaned as fish's onChange (uppercase, A–Z0–9, max 6); a paste is read whole, so a
 * pasted invite message gives its code (./code.ts codeFromPaste). Focused on open (a one-task
 * screen), capitals keyboard on a phone, no autocorrect / autofill.
 *
 * IME composition (Android Gboard composes whole words, even in a code field): rewriting the value
 * mid-composition duplicates or drops letters («k7» → «KK7»). While composing, the field shows the
 * raw text it is given and nothing is cleaned or reported; compositionend cleans and reports once.
 * A ref, not the state, gates it: Chrome may send the last input event after compositionend.
 *
 * The letter-spacing trails the last letter, so `indent` puts the same space before the first one:
 * the code stays optically centred. The shell is the kit's control (soft-fill at rest, surface +
 * accent border + tint ring on focus, danger on error), taller: 72 / 80 from 768.
 */
export function CodeField({ id, value, onChange, describedBy, invalid = false, disabled, ref }: Props) {
  const composing = useRef(false);
  const [draft, setDraft] = useState<string | null>(null);
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    e.preventDefault();
    onChange(codeFromPaste(text));
  };
  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (composing.current || (e.nativeEvent as InputEvent).isComposing) {
      setDraft(e.target.value);
      return;
    }
    onChange(cleanCode(e.target.value));
  };
  const onCompositionStart = (e: CompositionEvent<HTMLInputElement>) => {
    composing.current = true;
    setDraft(e.currentTarget.value);
  };
  const onCompositionEnd = (e: CompositionEvent<HTMLInputElement>) => {
    composing.current = false;
    setDraft(null);
    onChange(cleanCode(e.currentTarget.value));
  };
  return (
    <div
      className={cn(
        'flex h-18 items-center rounded-control border-2 px-3 transition-[background-color,border-color,box-shadow] duration-(--duration-fast) ease-fast md:h-20',
        invalid
          ? 'border-live bg-status-danger-bg/50'
          : 'border-transparent bg-soft-fill focus-within:border-accent focus-within:bg-surface focus-within:shadow-[0_0_0_4px_var(--color-accent-tint-2)]',
        disabled && 'opacity-60',
      )}
    >
      <input
        ref={ref}
        id={id}
        name="cod"
        value={draft ?? value}
        onChange={onInput}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        onPaste={onPaste}
        placeholder="COD"
        // Focus on open is the point of the screen (fish autoFocus).
        autoFocus
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        enterKeyHint="go"
        maxLength={CODE_LENGTH}
        // The browser's own check (pattern / required) never runs: the button is off until six.
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        readOnly={disabled}
        className={cn(
          'h-full w-full min-w-0 bg-transparent text-center text-ink uppercase outline-none placeholder:text-faint focus-visible:outline-none',
          't-num-40 tracking-[0.3em] indent-[0.3em]',
        )}
      />
    </div>
  );
}
