import Link from 'next/link';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';

/*
 * fish's «Bălți» / «Ape publice» SegmentedToggle (lakes.home.c1–c3; fish (tabs)/lakes/index.tsx:
 * width 240, height 38, a full-pill track with 3px padding, the current option a white pill with
 * the label in indigo-7, the other in gray-10, body 600), as navigation: each option is a page, so
 * they are links (aria-current marks the one shown). «Ape publice» opens the public-waters map with
 * nothing carried over — the lake filters and search live in /balti/harta's URL, so leaving them
 * behind clears them (c3). The launch «NOU» badge expired on 2026-09-06 and is not shipped (c2).
 *
 * Below 768 fish's look; from 768 the approved desktop look (the row's control height and shape,
 * white track, accent-tint current page).
 *
 * ONE component for every place it shows (owner 2026-10-10: «toggle inconsistent și arată urât»):
 * centred at the top of /balti and of /ape-publice on the phone, at the same width, height and
 * offset, so switching pages moves nothing; from 768 it leads the search row at the row's control
 * height (48, 40 from 1280). `floating`: over the map (/ape-publice on a phone) the same opaque
 * track and white pill, plus the floating shadow so it lifts off the map.
 */
const OPTIONS = [
  { key: 'balti', label: 'Bălți', href: routes.lakes() },
  { key: 'ape', label: 'Ape publice', href: routes.publicWaters() },
] as const;

export function WaterKindSwitch({
  current,
  hrefs,
  floating = false,
  className,
}: {
  current: 'balti' | 'ape';
  /** Where each option goes (the map view: «Bălți» = /balti/harta). Default: the section pages. */
  hrefs?: Partial<Record<'balti' | 'ape', string>>;
  /** Over the map: an opaque track with the floating shadow. */
  floating?: boolean;
  className?: string;
}) {
  return (
    <nav
      aria-label="Tip de apă"
      data-water-kind-switch=""
      className={cn(
        'grid h-9.5 w-60 shrink-0 grid-cols-2 rounded-full bg-fish-chip p-0.75',
        floating && 'shadow-e2',
        // From 768 the approved desktop look (unchanged): the search row's control height, a white
        // track with a hairline on the page ground, the current page in the accent tint.
        'md:h-12 md:rounded-control md:border md:border-hairline md:bg-surface md:shadow-none xl:h-10',
        className,
      )}
    >
      {OPTIONS.map((o) => {
        const active = o.key === current;
        return (
          <Link
            key={o.key}
            href={hrefs?.[o.key] ?? o.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center justify-center rounded-full t-body-strong transition-[background-color,color] duration-(--duration-fast) ease-select',
              'md:rounded-[calc(var(--radius-control)-3px)]',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
              active
                ? 'bg-surface text-accent-ink shadow-e1 md:bg-accent-tint md:shadow-none'
                : 'text-ink-2 hover:text-ink md:hover:bg-soft-fill',
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}
