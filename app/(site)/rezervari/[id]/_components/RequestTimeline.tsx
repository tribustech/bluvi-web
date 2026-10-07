import { CheckIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import type { TimelineStep } from '@/core/booking';
import { Card } from './Card';

/**
 * c12 — «Parcursul cererii», fish features/bookings/ui/RequestTimeline.tsx on core buildTimeline
 * (audience angler): a done step is a green check, the current one an indigo dot, a future one an
 * empty ring; a rejection / cancellation replaces the rest. Only the end step carries a time — the
 * booking has no dates for the others, and none is made up. An ordered list; each step's state is
 * spoken («finalizat», «în curs», «urmează»), not only drawn.
 */
const SPOKEN: Record<TimelineStep['state'], string> = { done: 'finalizat', current: 'în curs', future: 'urmează' };

function Bullet({ state }: { state: TimelineStep['state'] }) {
  if (state === 'done') {
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-status-success-bg text-status-success-fg">
        <CheckIcon className="size-3" strokeWidth={3} />
      </span>
    );
  }
  if (state === 'current') {
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-accent-tint-2">
        <span className="size-2.25 rounded-full bg-accent" />
      </span>
    );
  }
  return <span className="block size-5 rounded-full border-2 border-hairline" />;
}

export function RequestTimeline({ steps, className }: { steps: TimelineStep[]; className?: string }) {
  return (
    <Card title="Parcursul cererii" titleId="rezervare-parcurs" data-testid="request-timeline" className={className}>
      <ol className="flex flex-col">
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          return (
            <li key={step.key} data-step={step.key} data-state={step.state} className="flex gap-3">
              <span aria-hidden className="flex w-5 flex-col items-center">
                <Bullet state={step.state} />
                {last ? null : <span className="my-0.5 w-0.5 flex-1 bg-hairline" />}
              </span>
              <span className={cn('flex min-w-0 flex-1 flex-col', !last && 'pb-4')}>
                <span className={cn('t-body-strong', step.state === 'future' ? 'text-muted' : 'text-ink')}>
                  {step.title}
                  <span className="sr-only">, {SPOKEN[step.state]}</span>
                </span>
                {step.detail ? <span className="t-caption text-muted">{step.detail}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
