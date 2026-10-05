import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/20/solid';
import { cn } from '@/components/ui/cn';
import type { T4Step } from './types';

type StepsProps = {
  steps: T4Step[];
  /** Jump to a reachable step. Without it the steps are display only. */
  onSelect?: (id: string) => void;
  /** Accessible name of the step navigation: «Pașii rezervării». */
  label: string;
  className?: string;
};

const isReachable = (s: T4Step) => s.reachable ?? s.state !== 'upcoming';

/** «Pasul 2 din 3: Extra, completat» — what a screen reader hears on each step. */
function spoken(s: T4Step, i: number, n: number) {
  const state =
    s.state === 'done' ? 'completat' : s.state === 'error' ? 'are erori' : s.state === 'current' ? 'pasul curent' : 'urmează';
  return `Pasul ${i + 1} din ${n}: ${s.title}, ${state}`;
}

/**
 * Segment progress (below 1280) — fish StepIndicator: one bar per step, filled up to the current
 * one in plain accent (Fundații has no gradient fills for controls), a failed step in the danger
 * hue. From 768 each bar carries its title. Every segment is the same 24px-high box (a reachable
 * one is a button, so the thin bar is still a fair target, WCAG 2.5.8), so the bars of a mixed row
 * — some reachable, some not — sit on one line.
 */
export function T4Progress({ steps, onSelect, label, className }: StepsProps) {
  return (
    <nav aria-label={label} className={className}>
      <ol className="flex gap-1.5 md:gap-2">
        {steps.map((s, i) => {
          const filled = s.state === 'done' || s.state === 'current';
          const bar = (
            <>
              <span
                aria-hidden
                className={cn(
                  'block h-1 w-full rounded-full',
                  s.state === 'error'
                    ? 'bg-status-danger-fg'
                    : filled
                      ? 'bg-accent'
                      : 'bg-soft-fill',
                )}
              />
              <span
                className={cn(
                  't-caption hidden truncate text-left md:block',
                  s.state === 'current' ? 'text-ink' : s.state === 'error' ? 'text-status-danger-fg' : 'text-muted',
                  // Hover names the target (colour + underline); opacity is the press (Fundații §06).
                  'group-hover:text-ink group-hover:underline group-hover:underline-offset-2',
                )}
              >
                {s.title}
              </span>
            </>
          );
          const interactive = onSelect && isReachable(s) && s.state !== 'current';
          return (
            <li key={s.id} className="min-w-0 flex-1" aria-current={s.state === 'current' ? 'step' : undefined}>
              {interactive ? (
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  aria-label={spoken(s, i, steps.length)}
                  className="group flex min-h-6 w-full cursor-pointer flex-col justify-center gap-1.5 rounded-badge transition-opacity duration-(--duration-fast) active:opacity-70"
                >
                  {bar}
                </button>
              ) : (
                <span className="flex min-h-6 w-full flex-col justify-center gap-1.5">
                  <span className="sr-only">{spoken(s, i, steps.length)}</span>
                  {bar}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * The segment row's shape without steps: the real row's 24px segment boxes (plus the 16px caption
 * from 768, as the real row before any step is reachable). `shimmer`: grey loading bars (the
 * skeleton). Otherwise (a gate that can turn into step 1 in place — signed out, a load error):
 * the empty track at rest, soft-fill segments with no fill and no titles, so the reserved height
 * reads as the flow's progress not yet started rather than as a blank band.
 */
export function T4ProgressPlaceholder({ steps, shimmer = false }: { steps: number; shimmer?: boolean }) {
  return (
    <span aria-hidden className="flex gap-1.5 md:gap-2">
      {Array.from({ length: steps }, (_, i) => (
        <span key={i} className="flex min-h-6 flex-1 flex-col justify-center gap-1.5">
          <span className={cn('block h-1 w-full rounded-full bg-soft-fill', shimmer && 'animate-shimmer')} />
          <span className="hidden h-4 items-center md:flex">
            <span className={cn('block h-2.5 w-20 max-w-full rounded-full', shimmer ? 'bg-soft-fill animate-shimmer' : 'invisible')} />
          </span>
        </span>
      ))}
    </span>
  );
}

/**
 * Vertical step list (the left column from 1280): a numbered marker per step joined by a rule, the
 * title, and — once a step is done — what was chosen there, so the column reads as a running
 * summary. Current: filled accent disc (no glow: Fundații §04 keeps the glow for one card per
 * screen, never a template part). Done: tint + solid check. Error: danger + exclamation circle.
 * Upcoming: outlined number (the same 2px faint ring as T4ChoiceCard's unchecked marker). The marker
 * is 40 with a 16 gap — the header's back control and its gap — so the titles start on the header
 * title's column (T4_TITLE_INDENT).
 */
export function T4StepList({ steps, onSelect, label, className }: StepsProps) {
  return (
    <nav aria-label={label} className={className}>
      <ol className="flex flex-col">
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          const interactive = onSelect && isReachable(s) && s.state !== 'current';
          const body = (
            <>
              <span className="relative flex flex-col items-center self-stretch">
                <Marker step={s} index={i} />
                {!last ? (
                  <span
                    aria-hidden
                    className={cn('mt-1 w-0.5 flex-1 rounded-full', s.state === 'done' ? 'bg-accent' : 'bg-soft-fill')}
                  />
                ) : null}
              </span>
              <span className={cn('flex min-w-0 flex-1 flex-col pt-2', last ? 'pb-1' : 'pb-5')}>
                <span
                  className={cn(
                    't-body-strong',
                    s.state === 'upcoming' ? 'text-muted' : s.state === 'error' ? 'text-status-danger-fg' : 'text-ink',
                  )}
                >
                  {s.title}
                </span>
                {s.summary ? <span className="t-caption text-muted">{s.summary}</span> : null}
                {s.state === 'error' ? <span className="t-caption text-status-danger-fg">Are câmpuri de corectat</span> : null}
              </span>
            </>
          );
          return (
            <li key={s.id} aria-current={s.state === 'current' ? 'step' : undefined}>
              {interactive ? (
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  aria-label={spoken(s, i, steps.length)}
                  className="-mx-2 flex w-[calc(100%+--spacing(4))] cursor-pointer gap-4 rounded-control px-2 pt-1 text-left transition-[background-color,opacity] duration-(--duration-fast) hover:bg-soft-fill active:opacity-70"
                >
                  {body}
                </button>
              ) : (
                <div className="-mx-2 flex gap-4 px-2 pt-1">
                  <span className="sr-only">{spoken(s, i, steps.length)}</span>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Marker({ step, index }: { step: T4Step; index: number }) {
  const base = 't-label flex size-10 shrink-0 items-center justify-center rounded-full tabular-nums';
  if (step.state === 'done')
    return (
      <span aria-hidden className={cn(base, 'bg-accent-tint-2 text-accent-ink')}>
        <CheckIcon className="size-5" />
      </span>
    );
  if (step.state === 'error')
    return (
      <span aria-hidden className={cn(base, 'bg-status-danger-bg text-status-danger-fg')}>
        <ExclamationCircleIcon className="size-6" />
      </span>
    );
  if (step.state === 'current')
    return (
      <span aria-hidden className={cn(base, 'bg-accent text-on-accent')}>
        {index + 1}
      </span>
    );
  return (
    <span aria-hidden className={cn(base, 'border-2 border-faint bg-surface text-muted')}>
      {index + 1}
    </span>
  );
}
