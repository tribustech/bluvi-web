'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { BackspaceIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { clampWeight, fmtKg } from '@/core/partide';
import { ScaleIcon } from '@/components/icons/brand';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { backspace, bufferToWeight, decimalPlaceholder, pressComma, pressDigit, seedBuffer } from './weight';

/*
 * «GREUTATE» (parity partide.captura.c4; fish captura.tsx GREUTATE card + WeightKeypad). Weight is
 * optional:
 *  - state A, no weight: «Adaugă greutatea» / «Opțional — captura se salvează și fără», which opens
 *    the keypad;
 *  - state B: − / the number / + (0,1 kg steps), «Atinge pentru a scrie», and the
 *    «Cântărită» / «Estimată» source toggle.
 * The keypad opens INSIDE the card (fish: a keyboard panel under it): 1–9, «,», 0, ⌫, then
 * «Fără greutate» (drop the number) and «Gata». The card shows the RAW typed string with a caret and
 * the empty decimal slots in grey (weight.ts). A physical keyboard types into it too (digits, «,»
 * or «.», Backspace, Enter / Escape close). A refused key (a 4th decimal, past 60 kg) flashes the
 * number and is announced — never silently dropped. The unit «kg» is its own, muted element.
 */

/** The big number: 40 on the phone (it shares the row with the two steppers), 64 from 768. */
const NUM = 't-num-40 md:t-num-64';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'back'] as const;

export function WeightCard({
  weight,
  estimated,
  onWeight,
  onEstimated,
}: {
  weight: number | null;
  estimated: boolean;
  onWeight: (w: number | null) => void;
  onEstimated: (estimated: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [buffer, setBuffer] = useState('');
  // A refused key flashes the number in the danger colour for a moment and says why (fish: a
  // warning haptic — «heard you, not allowed»).
  const [refused, setRefused] = useState(false);
  useEffect(() => {
    if (!refused) return undefined;
    const t = setTimeout(() => setRefused(false), 600);
    return () => clearTimeout(t);
  }, [refused]);
  const displayRef = useRef<HTMLDivElement>(null);

  const openKeypad = () => {
    setBuffer(seedBuffer(weight));
    setOpen(true);
  };
  useEffect(() => {
    if (open) displayRef.current?.focus({ preventScroll: false });
  }, [open]);

  const type = (next: string) => {
    setBuffer(next);
    onWeight(bufferToWeight(next));
  };
  const press = (key: (typeof KEYS)[number] | string) => {
    if (key === 'back') return type(backspace(buffer));
    if (key === ',' || key === '.') return type(pressComma(buffer));
    const next = pressDigit(buffer, key);
    if (next == null) return setRefused(true);
    type(next);
  };
  // A step while the keypad is open re-seeds the typed string, so the number shown is the value
  // saved and the next key builds on it (fish cannot get here: its keypad is a modal sheet).
  const step = (delta: number) => {
    if (weight == null) return;
    const next = clampWeight(weight + delta);
    onWeight(next);
    if (open) setBuffer(seedBuffer(next));
  };
  const close = () => setOpen(false);
  const clear = () => {
    type('');
    onEstimated(false);
    setOpen(false);
  };

  // While the keypad is open the whole card takes the physical keys (the focus may sit on a key).
  // Enter closes only from the number itself — on a focused key it presses that key.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!open || e.altKey || e.ctrlKey || e.metaKey) return;
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === ',' || e.key === '.') press(',');
    else if (e.key === 'Backspace') press('back');
    else if (e.key === 'Escape' || (e.key === 'Enter' && e.target === displayRef.current)) close();
    else return;
    e.preventDefault();
  };

  if (weight == null && !open) {
    return (
      <button
        type="button"
        onClick={openKeypad}
        data-testid="weight-add"
        className="flex w-full cursor-pointer items-center gap-3.5 rounded-card bg-surface p-4 text-left shadow-e1 transition-[filter] duration-(--duration-fast) hover:brightness-[0.98]"
      >
        <ScaleIcon size={26} className="shrink-0 text-accent" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="t-body-strong text-ink">Adaugă greutatea</span>
          <span className="t-caption text-muted">Opțional — captura se salvează și fără</span>
        </span>
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-card bg-accent text-on-accent">
          <PlusIcon className="size-5.5 stroke-[2.8]" />
        </span>
      </button>
    );
  }

  const typed = buffer || '0';
  const placeholder = decimalPlaceholder(buffer);
  return (
    <div data-testid="weight-card" onKeyDown={onKeyDown} className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-e1">
      <div className="flex items-center justify-between gap-3">
        <Stepper label="Scade 0,1 kg" disabled={weight == null} onClick={() => step(-0.1)}>
          <MinusIcon className="size-5.5 stroke-[2.6]" />
        </Stepper>
        <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <div
            ref={displayRef}
            role={open ? 'textbox' : 'button'}
            tabIndex={0}
            aria-label={open ? 'Greutate în kilograme' : `Greutate ${weight == null ? 'necompletată' : `${fmtKg(weight)} kg`}, atinge pentru a scrie`}
            aria-live={open ? 'polite' : undefined}
            data-testid="weight-value"
            data-refused={refused || undefined}
            onClick={open ? undefined : openKeypad}
            onKeyDown={open ? undefined : e => (e.key === 'Enter' || e.key === ' ' ? (e.preventDefault(), openKeypad()) : undefined)}
            className="flex cursor-pointer items-baseline justify-center gap-1.5 rounded-card px-3 py-1 outline-none focus-visible:bg-accent-tint focus-visible:ring-2 focus-visible:ring-accent-tint-2"
          >
            {open ? (
              <span className="flex items-baseline">
                <span className={cn(NUM, refused ? 'text-status-danger-fg' : buffer ? 'text-ink' : 'text-muted')}>{typed}</span>
                <span aria-hidden className="mx-0.5 h-8 w-0.5 md:h-12 self-center animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
                {placeholder ? (
                  <span aria-hidden className={cn(NUM, 'text-faint')}>
                    {placeholder}
                  </span>
                ) : null}
              </span>
            ) : (
              <span className={cn(NUM, weight == null ? 'text-muted' : 'text-ink')}>{weight == null ? '0,0' : fmtKg(weight)}</span>
            )}
            <span className="t-title2 text-muted md:t-title1">kg</span>
          </div>
          <p aria-live="polite" className="sr-only">
            {refused ? 'Maximum 60 kg, cu cel mult 3 zecimale.' : ''}
          </p>
          {!open ? (
            <button type="button" onClick={openKeypad} className="flex cursor-pointer items-center gap-1.5 rounded-full bg-soft-fill px-3 py-1.5 t-micro-strong text-accent-ink hover:brightness-95">
              Atinge pentru a scrie
            </button>
          ) : null}
        </div>
        <Stepper label="Crește 0,1 kg" solid disabled={weight == null} onClick={() => step(0.1)}>
          <PlusIcon className="size-5.5 stroke-[2.8]" />
        </Stepper>
      </div>

      {open ? (
        <div data-testid="weight-keypad" className="flex w-full flex-col gap-2.5 rounded-card bg-page p-2.5 md:mx-auto md:max-w-100">
          <div role="group" aria-label="Tastatură greutate" className="grid grid-cols-3 gap-2">
            {KEYS.map(k => (
              <button
                key={k}
                type="button"
                onClick={() => press(k)}
                aria-label={k === 'back' ? 'Șterge ultima cifră' : k === ',' ? 'Virgulă' : k}
                className="flex h-13 cursor-pointer items-center justify-center rounded-control bg-surface t-num-26 text-ink shadow-button transition-[filter] duration-(--duration-fast) hover:brightness-95 active:opacity-80"
              >
                {k === 'back' ? <BackspaceIcon aria-hidden className="size-6" /> : k}
              </button>
            ))}
          </div>
          <div className="flex gap-2.5">
            {buffer ? (
              <Button type="button" variant="secondary" className="flex-1" onClick={clear}>
                Fără greutate
              </Button>
            ) : null}
            <Button type="button" className="flex-1" onClick={close}>
              Gata
            </Button>
          </div>
        </div>
      ) : null}

      {/* Full-width track: the two halves stay equal whatever the labels are. */}
      <div role="radiogroup" aria-label="Sursa greutății" className="grid grid-cols-2 rounded-full bg-soft-fill p-[3px]">
        {(
          [
            ['Cântărită', false],
            ['Estimată', true],
          ] as const
        ).map(([label, value]) => {
          const active = estimated === value;
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onEstimated(value)}
              className={cn(
                'h-9 cursor-pointer rounded-full t-label transition-colors duration-(--duration-fast)',
                active ? 'bg-surface text-accent-ink shadow-e1' : 'text-muted hover:text-ink-2',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Stepper({ label, solid = false, disabled, onClick, children }: { label: string; solid?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-13 shrink-0 cursor-pointer items-center justify-center rounded-card transition-[filter,opacity] duration-(--duration-fast) hover:brightness-95 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40',
        solid ? 'bg-accent text-on-accent' : 'bg-soft-fill text-muted',
      )}
    >
      {children}
    </button>
  );
}
