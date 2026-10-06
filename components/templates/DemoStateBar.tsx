import Link from 'next/link';
import { Fragment } from 'react';
import { FULL_BLEED_BG, FULL_BLEED_RULE, SHELL_GUTTERS, SHELL_MAX } from '@/components/nav/shell';
import { cn } from '@/components/ui/cn';

/** One state of a template demo: a link to it (`?state=…`). */
export type DemoStateChip = {
  key: string;
  label: string;
  href: string;
  current?: boolean;
  /** Shown on hover (what the state simulates). */
  title?: string;
  /** Not a parity state (a template-only one): a dashed edge sets it apart. */
  dashed?: boolean;
};

/**
 * THE dev strip of every template demo (/dev/templates/t1…t6) — not part of any template, so it is
 * one piece of chrome the owner learns once: a white band edge to edge under the top bar (full
 * bleed, hairline under it) with the shell's column inside, the demo's name as an eyebrow, and the
 * states as one row of chips that scrolls sideways at every width, its right edge fading while
 * there is more (never a chip clipped mid-word, never a second row). `groups`: several sets of
 * chips (T3: screen · state), a hairline between them. `current` unknown (a Suspense fallback):
 * the same chips, none marked — the same height.
 */
export function DemoStateBar({
  label,
  title,
  hint,
  groups,
}: {
  /** The landmark's name («Stări demo T5»). */
  label: string;
  /** The eyebrow («T5 · Dashboard»). */
  title: string;
  /** The current state's note («simulat»), after the eyebrow. */
  hint?: string;
  groups: DemoStateChip[][];
}) {
  return (
    <nav aria-label={label} className={cn('shrink-0', FULL_BLEED_BG, FULL_BLEED_RULE)}>
      <div className={cn('mx-auto flex min-h-12 items-center gap-3 py-2', SHELL_MAX, SHELL_GUTTERS)}>
        <p className="max-w-[40%] shrink-0 truncate t-eyebrow text-muted uppercase">
          {title}
          {hint ? <span className="normal-case"> — {hint}</span> : null}
        </p>
        <ul className="-my-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1 pr-8 [scrollbar-width:none] [mask-image:linear-gradient(to_left,transparent,black_--spacing(8))] [&::-webkit-scrollbar]:hidden">
          {groups.map((chips, g) => (
            <Fragment key={g}>
              {g > 0 ? <li aria-hidden className="mx-1 h-5 w-px shrink-0 bg-hairline" /> : null}
              {chips.map((c) => (
                <li key={c.key} className="shrink-0">
                  <Link
                    href={c.href}
                    title={c.title}
                    aria-current={c.current ? 'page' : undefined}
                    className={cn(
                      'inline-flex h-8 items-center rounded-full px-3 t-label whitespace-nowrap transition-colors duration-(--duration-fast)',
                      c.current ? 'bg-navy text-lavender' : 'bg-soft-fill text-ink-2 hover:bg-accent-tint hover:text-accent-ink',
                      c.dashed && !c.current && 'border border-dashed border-faint',
                    )}
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
            </Fragment>
          ))}
        </ul>
      </div>
    </nav>
  );
}
