import Link from 'next/link';
import { SHELL_GUTTERS, SHELL_MAX } from '@/components/nav/shell';
import { cn } from '@/components/ui/cn';
import { DEMO_STATES, type DemoState } from './states';

/**
 * The dev strip under the top bar (layout.tsx) with the state switcher. Not part of the template;
 * it scrolls away with the page. The links keep the demo's `?lake=`. `state: null` = still being
 * read (the Suspense fallback): the same strip, nothing marked current.
 */
export function StateStrip({ state, lake }: { state: DemoState | null; lake?: string }) {
  const href = (key: DemoState) => {
    const q = new URLSearchParams();
    if (key !== 'default') q.set('state', key);
    if (lake) q.set('lake', lake);
    const s = q.toString();
    return `/dev/templates/t4${s ? `?${s}` : ''}`;
  };
  return (
    <nav aria-label="Stările demonstrației T4" className="border-b border-hairline bg-soft-fill">
      <div className={cn('mx-auto flex items-center gap-3 py-2', SHELL_MAX, SHELL_GUTTERS)}>
        <span className="t-eyebrow shrink-0 text-muted uppercase">T4 · stare</span>
        <ul className="-my-1 flex min-w-0 gap-1.5 overflow-x-auto py-1">
          {DEMO_STATES.map((s) => (
            <li key={s.key} className="shrink-0">
              <Link
                href={href(s.key)}
                aria-current={s.key === state ? 'page' : undefined}
                title={s.hint}
                className={cn(
                  't-label inline-flex h-8 items-center rounded-full px-3 transition-colors duration-(--duration-fast)',
                  s.key === state ? 'bg-accent-ink text-on-accent' : 'bg-surface text-ink-2 shadow-e0 hover:text-ink',
                )}
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
