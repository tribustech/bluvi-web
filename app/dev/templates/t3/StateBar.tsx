import Link from 'next/link';
import { cn } from '@/components/ui/cn';
import { demoHref, SCREENS, STATES, type DemoState, type Screen } from './states';

/**
 * Dev-only switcher above the template: which T3 user, which state. Not part of the template.
 * Without a screen (the static shell, before the URL is known) it is a placeholder of the same
 * height: the label only, no chip current.
 */
export function StateBar({ screen, state }: { screen?: Screen; state?: DemoState }) {
  const states = screen ? STATES.filter(s => !('screens' in s) || (s.screens as readonly Screen[]).includes(screen)) : [];
  return (
    <nav aria-label="Demo T3: ecran și stare" className="border-b border-dashed border-faint bg-page px-4 py-2 md:px-6 xl:px-8">
      <ul className="flex min-h-7 items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
        <li className="shrink-0 pr-1 t-eyebrow text-muted uppercase">T3</li>
        {!screen || !state ? null : (
          <>
            {SCREENS.map(s => (
              <li key={s.key} className="shrink-0">
                <Chip href={demoHref(s.key, state)} current={s.key === screen} strong>
                  {s.label}
                </Chip>
              </li>
            ))}
            <li aria-hidden className="mx-1 h-5 w-px shrink-0 bg-hairline" />
            {states.map(s => (
              <li key={s.key} className="shrink-0">
                <Chip href={demoHref(screen, s.key)} current={s.key === state}>
                  {s.label}
                </Chip>
              </li>
            ))}
          </>
        )}
      </ul>
    </nav>
  );
}

function Chip({ href, current, strong, children }: { href: string; current: boolean; strong?: boolean; children: string }) {
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'flex h-7 items-center rounded-full px-2.5 t-label whitespace-nowrap',
        current ? (strong ? 'bg-navy text-on-photo-scrim' : 'bg-accent-ink text-on-accent') : 'bg-surface text-ink-2 shadow-e0 hover:bg-soft-fill',
      )}
    >
      {children}
    </Link>
  );
}
