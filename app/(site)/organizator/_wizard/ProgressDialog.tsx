'use client';

import { useSyncExternalStore } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { getOperationCaption } from '@/core/organizer';
import { Dialog } from '@/components/surfaces/Dialog';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import type { WizardOperation } from './context';

/*
 * The blocking progress dialog (organizer.wizard.c15, c16, c20; fish _layout.tsx «Save progress
 * sheet»): opens while a save / publish / delete runs and cannot be dismissed (no X, the backdrop
 * and Escape do nothing); as a modal <dialog> it makes the page behind inert. It shows the fishing
 * animation (fish's Lottie, here an SVG float bobbing on its ripples, still under reduced motion),
 * the status line, a progress bar with the rounded percentage, and the caption (a rotating joke
 * while publishing). After 60 s without an answer it turns into the recovery notice: «Rămâi aici»
 * and «Verifică lista» / «Verifică competiția».
 */

function subscribeMotion(onChange: () => void) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => true,
  );
}

/** A float on the water: it bobs and sends ripples out (SVG SMIL, no Lottie on the web). */
export function FishingFloat({ className }: { className?: string }) {
  const still = useReducedMotion();
  return (
    <svg viewBox="0 0 160 112" aria-hidden className={cn('h-28 w-40', className)} data-testid="wizard-progress-animation">
      {/* The line from the rod tip, out of frame. */}
      <path d="M80 0 L80 46" className="stroke-ink-2" strokeWidth={1.5} strokeLinecap="round" fill="none">
        {still ? null : <animate attributeName="d" values="M80 0 L80 46;M80 0 L80 50;M80 0 L80 46" dur="1.8s" repeatCount="indefinite" />}
      </path>
      {/* Ripples. */}
      {[0, 0.6, 1.2].map(begin => (
        <ellipse key={begin} cx={80} cy={78} rx={14} ry={4} className="stroke-accent" strokeWidth={1.5} fill="none" opacity={still ? 0.35 : 0}>
          {still ? null : (
            <>
              <animate attributeName="rx" values="12;58" dur="1.8s" begin={`${begin}s`} repeatCount="indefinite" />
              <animate attributeName="ry" values="3;12" dur="1.8s" begin={`${begin}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0" dur="1.8s" begin={`${begin}s`} repeatCount="indefinite" />
            </>
          )}
        </ellipse>
      ))}
      {/* The water line. */}
      <path d="M8 80 Q 28 74 48 80 T 88 80 T 128 80 T 152 80" className="stroke-accent-tint-3" strokeWidth={2} fill="none" strokeLinecap="round" />
      {/* The float: red top, white band, body. */}
      <g>
        {still ? null : (
          <animateTransform attributeName="transform" type="translate" values="0 0;0 5;0 -1;0 0" dur="1.8s" repeatCount="indefinite" />
        )}
        <path d="M80 44 L80 50" className="stroke-ink-2" strokeWidth={1.5} />
        <ellipse cx={80} cy={58} rx={7} ry={9} className="fill-status-danger-fg" />
        <rect x={73} y={63} width={14} height={4} className="fill-surface" />
        <ellipse cx={80} cy={74} rx={7} ry={8} className="fill-accent" />
        <path d="M80 82 L80 90" className="stroke-accent" strokeWidth={2} strokeLinecap="round" />
      </g>
    </svg>
  );
}

const noop = () => {};

/**
 * With no control inside (the progress state), showModal() focuses the <dialog> itself: no ring on
 * it (owner rule 8, rings are for controls only).
 */
const NO_RING = 'outline-none focus-visible:outline-none';

export function ProgressDialog({
  operation,
  onStay,
  onCheck,
}: {
  operation: WizardOperation;
  onStay: () => void;
  onCheck: () => void;
}) {
  const open = operation.mode !== null || operation.timedOut;
  const percent = Math.round(Math.max(0, Math.min(100, operation.progress)));
  const recovery = operation.recovery;

  if (operation.timedOut) {
    return (
      <Dialog
        open={open}
        onClose={noop}
        alert
        backdropDismiss={false}
        titleHidden
        className={NO_RING}
        title={recovery?.title ?? 'Operațiunea durează mai mult decât estimăm'}
        actions={
          <>
            <Button variant="secondary" onClick={onCheck}>
              {recovery?.primaryLabel ?? 'Verifică lista'}
            </Button>
            <Button onClick={onStay}>Rămâi aici</Button>
          </>
        }
      >
        <div data-testid="wizard-timeout" className="flex flex-col items-center gap-3 pt-2 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-status-warning-bg text-status-warning-fg">
            <ExclamationTriangleIcon aria-hidden className="size-6" />
          </span>
          <p className="t-title2 text-ink">{recovery?.title ?? 'Operațiunea durează mai mult decât estimăm'}</p>
          <p className="t-body text-muted">
            {recovery?.description ?? 'Nu putem confirma starea. Verifică în lista de competiții.'}
          </p>
        </div>
      </Dialog>
    );
  }

  const status = operation.statusText || 'Operațiune în curs...';
  const caption = operation.mode ? getOperationCaption(operation.mode, operation.jokeText) : '';
  return (
    <Dialog open={open} onClose={noop} alert backdropDismiss={false} titleHidden title={status} className={NO_RING}>
      <div data-testid="wizard-progress" className="flex flex-col items-center gap-4 pt-1 pb-1 text-center">
        <FishingFloat />
        <p
          role="status"
          className={cn('text-ink', operation.mode === 'publish' ? 't-title2' : 't-body-strong')}
          data-testid="wizard-progress-status"
        >
          {status}
        </p>
        <div className="flex w-full flex-col gap-2">
          <div
            role="progressbar"
            aria-label={status}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-2.5 w-full overflow-hidden rounded-full bg-soft-fill"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-(--duration-slow) ease-out motion-reduce:transition-none"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="t-caption text-accent-ink tabular-nums" data-testid="wizard-progress-percent">
            {percent}%
          </span>
        </div>
        {caption ? (
          <p className="t-caption min-h-lh text-muted" data-testid="wizard-progress-caption" aria-live="polite">
            {caption}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
