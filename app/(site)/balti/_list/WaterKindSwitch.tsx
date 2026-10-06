import Link from 'next/link';
import { CONTROL_H } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';

/*
 * fish's «Bălți» / «Ape publice» SegmentedToggle (lakes.home.c1–c3), as navigation: each option is
 * a page, so they are links (aria-current marks the one shown). «Ape publice» opens the
 * public-waters map with nothing carried over — the lake filters and search live in /balti/harta's
 * URL, so leaving them behind clears them (c3). The launch «NOU» badge expired on 2026-09-06 and is
 * not shipped (c2).
 *
 * Drawn on the kit SegmentedControl's look (3px inset, the inset radius) at the toolbar's control
 * height and type (CONTROL_H 48 / 40, t-body-strong — FilterButton's), so the row is one height,
 * with the track it needs on the page ground: the kit's soft-fill track is ≈1.02:1 against bg-page
 * and vanished, so here the track is a white surface with a hairline and the current page is the
 * accent tint (the selected look of every kit choice).
 * TODO(kit): a link mode (href + aria-current) and an `onPage` track on components/forms/
 * SegmentedControl, then render this through it — the kit file is outside this task.
 */
const OPTIONS = [
  { key: 'balti', label: 'Bălți', href: routes.lakes() },
  { key: 'ape', label: 'Ape publice', href: routes.publicWaters() },
] as const;

export function WaterKindSwitch({
  current,
  hrefs,
}: {
  current: 'balti' | 'ape';
  /** Where each option goes (the map view: «Bălți» = /balti/harta). Default: the section pages. */
  hrefs?: Partial<Record<'balti' | 'ape', string>>;
}) {
  return (
    <nav aria-label="Tip de apă" className={cn('grid w-60 shrink-0 grid-cols-2 rounded-control border border-hairline bg-surface p-0.75', CONTROL_H)}>
      {OPTIONS.map((o) => {
        const active = o.key === current;
        return (
          <Link
            key={o.key}
            href={hrefs?.[o.key] ?? o.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center justify-center rounded-[calc(var(--radius-control)-3px)] t-body-strong transition-[background-color,color] duration-(--duration-fast) ease-select',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
              active ? 'bg-accent-tint text-accent-ink' : 'text-ink-2 hover:bg-soft-fill hover:text-ink',
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}
