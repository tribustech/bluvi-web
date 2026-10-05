import Link from 'next/link';
import { cn } from '@/components/ui/cn';
import { DEMO_STATES, TEMPLATE_ONLY_STATES, type DemoState } from './states';

/**
 * Dev strip above the template: every state as a link (?state=…). Not part of T2. `current` is
 * the state the URL asks for (null while it is not known yet: the Suspense fallback).
 */
export function StateSwitcher({ current }: { current: DemoState | null }) {
  return (
    <nav aria-label="Stări demo T2" className="shrink-0 border-b border-hairline bg-surface">
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] md:px-6 xl:px-8">
        <p className="mr-2 shrink-0 t-eyebrow text-muted uppercase">T2 · Listă cu hartă</p>
        {(Object.keys(DEMO_STATES) as DemoState[]).map((s) => (
          <Link
            key={s}
            href={s === 'results' ? '?' : `?state=${s}`}
            aria-current={s === current ? 'page' : undefined}
            className={cn(
              'flex h-7 shrink-0 items-center rounded-full px-3 t-label whitespace-nowrap',
              s === current ? 'bg-navy text-on-accent' : 'bg-soft-fill text-ink-2 hover:text-ink',
              // Not a parity state: set apart by a dashed edge (states.ts TEMPLATE_ONLY_STATES).
              TEMPLATE_ONLY_STATES.has(s) && s !== current && 'border border-dashed border-faint',
            )}
          >
            {DEMO_STATES[s]}
          </Link>
        ))}
      </div>
    </nav>
  );
}
