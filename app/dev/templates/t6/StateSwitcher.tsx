'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/components/ui/cn';
import { STATES, type DemoState } from './states';

/** Reads ?state= on the client, so the switcher renders outside the page's data Suspense. */
export function StateSwitcher() {
  const state = useSearchParams().get('state') ?? '';
  return <StateSwitcherView current={STATES.some((s) => s.value === state) ? (state as DemoState) : ''} />;
}

/**
 * Demo chrome: one chip per state, scrolls sideways on a phone. Not part of the template.
 * `current` undefined (the Suspense fallback): same chips, none marked, same height.
 */
export function StateSwitcherView({ current }: { current?: DemoState }) {
  return (
    <nav aria-label="Stări demo T6" className="border-b border-hairline bg-soft-fill">
      <ul className="flex gap-1.5 overflow-x-auto px-4 py-2 md:flex-wrap md:px-6 xl:px-8">
        <li className="t-eyebrow flex shrink-0 items-center pr-1 text-muted uppercase">T6 demo</li>
        {STATES.map((s) => {
          const active = s.value === current;
          return (
            <li key={s.value || 'default'} className="shrink-0">
              <Link
                href={s.value ? `/dev/templates/t6?state=${s.value}` : '/dev/templates/t6'}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  't-label inline-flex h-8 items-center rounded-full px-3 transition-colors duration-(--duration-fast)',
                  active ? 'bg-ink text-surface' : 'bg-surface text-ink-2 shadow-e0 hover:text-ink',
                )}
              >
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
