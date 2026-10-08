'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { cn } from './cn';

/** fish HoldToConfirmButton DEFAULT_DURATION_MS. */
export const HOLD_MS = 1500;
/** How long the «press again» step of the accessible alternative stays armed. */
const ARMED_MS = 6000;

/**
 * fish components/HoldToConfirmButton.tsx — a destructive confirmation that cannot happen by
 * accident: it fires only after the button is held for `durationMs` (1.5 s). The fill grows while
 * held; letting go early resets it.
 *
 * Three ways to confirm (WCAG 2.5.1 / 2.1.1: a path-based or timed gesture needs an alternative):
 *  - pointer: press and hold (mouse, touch, pen);
 *  - keyboard: hold Space or Enter — the key's auto-repeat is ignored, the hold ends on key up;
 *  - assistive tech / switch access, whose «activate» is a single synthetic click (no pointer, no
 *    key held): the first activation arms the button («Apasă din nou pentru a confirma», spoken),
 *    a second one within 6 s confirms. Nothing else ever confirms on a plain click.
 *
 * The fill is drawn with the Web Animations API (linear, as fish), so the site's reduced-motion
 * rule (which clamps CSS transitions) never turns the progress into a jump; the timer, not the
 * animation, decides. Colours: the danger pair, filled (white on rose-700, 6.1:1), the progress a
 * navy wash over it (more contrast as it grows).
 */
export function HoldToConfirmButton({
  label,
  onConfirm,
  durationMs = HOLD_MS,
  disabled = false,
  busy = false,
  className,
}: {
  label: string;
  onConfirm: () => void;
  durationMs?: number;
  disabled?: boolean;
  /** The confirmed action is running: the button stays focusable (aria-disabled) and says so. */
  busy?: boolean;
  className?: string;
}) {
  const fill = useRef<HTMLSpanElement>(null);
  const run = useRef<Animation | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holding = useRef(false);
  const fired = useRef(false);
  const [armed, setArmed] = useState(false);
  const [held, setHeld] = useState(false);
  const hintId = useId();
  const inert = disabled || busy;

  const confirm = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    setArmed(false);
    onConfirm();
  }, [onConfirm]);

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    holding.current = false;
    setHeld(false);
    const el = fill.current;
    run.current?.cancel();
    run.current = null;
    if (el && typeof el.animate === 'function') {
      // Ease back from where the hold stopped (fish: 150 ms).
      const from = getComputedStyle(el).transform;
      el.animate([{ transform: from === 'none' ? 'scaleX(0)' : from }, { transform: 'scaleX(0)' }], { duration: 150, easing: 'ease-out' });
    }
  }, []);

  const start = useCallback(() => {
    if (inert || holding.current) return;
    holding.current = true;
    fired.current = false;
    setHeld(true);
    const el = fill.current;
    if (el && typeof el.animate === 'function') {
      run.current = el.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: durationMs, easing: 'linear', fill: 'forwards' });
    }
    timer.current = setTimeout(() => {
      holding.current = false;
      setHeld(false);
      confirm();
    }, durationMs);
  }, [inert, durationMs, confirm]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (armTimer.current) clearTimeout(armTimer.current);
      run.current?.cancel();
    },
    [],
  );

  // A busy / disabled button drops any pending hold (and shows no armed step: `isArmed` below).
  useEffect(() => {
    if (inert && holding.current) reset();
  }, [inert, reset]);
  const isArmed = armed && !inert;

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    start();
  };
  const onPointerEnd = () => {
    if (holding.current) reset();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    // The key's own click (Enter on down, Space on up) must never confirm: only the hold does.
    e.preventDefault();
    if (!e.repeat) start();
  };
  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (holding.current) reset();
  };
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    // A pointer click follows a pointer hold (detail ≥ 1): the hold already decided.
    if (e.detail !== 0 || inert) return;
    // Assistive tech / switch activation: arm, then confirm on the second activation.
    if (isArmed) {
      if (armTimer.current) clearTimeout(armTimer.current);
      confirm();
      return;
    }
    fired.current = false;
    setArmed(true);
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setArmed(false), ARMED_MS);
  };

  const text = busy ? 'Se procesează…' : isArmed ? 'Apasă din nou pentru a confirma' : label;

  return (
    <>
      <button
        type="button"
        aria-disabled={inert || undefined}
        aria-busy={busy || undefined}
        aria-describedby={hintId}
        data-holding={held || undefined}
        data-armed={isArmed || undefined}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onLostPointerCapture={onPointerEnd}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={onPointerEnd}
        onClick={onClick}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          'relative isolate flex h-13 w-full touch-none items-center justify-center overflow-hidden rounded-control px-4 select-none',
          'bg-status-danger-fg t-body-strong text-on-accent [-webkit-touch-callout:none]',
          inert ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          className,
        )}
      >
        <span ref={fill} aria-hidden className="absolute inset-0 z-behind origin-left scale-x-0 bg-navy/35" />
        <span aria-live="polite">{text}</span>
      </button>
      <span id={hintId} className="sr-only">
        Ține apăsat până la final pentru a confirma, sau activează de două ori.
      </span>
    </>
  );
}
