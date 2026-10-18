'use client';

import Link from 'next/link';
import { Suspense, useEffect, useRef } from 'react';
import { PlusIcon } from '@heroicons/react/20/solid';
import { usePinned } from '@/components/nav/stickyStack';
import { DashboardHeader } from '@/components/templates/T5';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { appLinks } from '@/lib/app-links';
import { partideHrefs } from '@/lib/partide-pages';
import { routes } from '@/lib/routes';
import { usePartideViewer } from './activePartida';

/*
 * fish features/partide/components/PartideChrome.tsx — the Partide hub's chrome, shared by its three
 * tabs (Comunitate here; Explorează and Ale mele in later batches read it as is):
 *  - the T5 header: the title «Partide» (h1), the indigo «Începe» pill (plus) — only when the viewer
 *    has NO live partidă (c1), and into the app (owner 2026-10-08); no refresh control (owner 2026-10-11);
 *  - under it the underline tabs (c2): Comunitate · Explorează · Ale mele, each its own URL, so the
 *    choice is never persisted (c3: /partide always opens on Comunitate). Owner rule 20: one bar on
 *    a hairline, the active tab in the accent ink on a 2.5px underline, hover and focus states.
 *    Re-selecting the active tab scrolls back to the top (fish handleSubTabChange). A tab whose page
 *    is not on the web yet is left out (an inert tab reads as broken on touch — fish never has a dead
 *    tap), and while «Comunitate» would be alone there is no tab bar at all. The bar pins under the
 *    top bar on scroll (owner 2026-10-18, §4b rule 26: «păstrăm meniul sus la scroll»; on the phone,
 *    which has no top bar, at the top edge), on the page's own background, bleeding to the gutters;
 *    its height is PARTIDE_TABS_H_VAR so a row pinned under it (Explorează's filters) sits below.
 */

export type PartideTab = 'comunitate' | 'exploreaza' | 'ale-mele';

const TABS: { value: PartideTab; label: string; href: () => string | null }[] = [
  { value: 'comunitate', label: 'Comunitate', href: () => routes.partide() },
  { value: 'exploreaza', label: 'Explorează', href: () => partideHrefs.explore() },
  { value: 'ale-mele', label: 'Ale mele', href: () => partideHrefs.mine() },
];

export function PartideHeader() {
  return (
    <DashboardHeader
      // From 768 the top bar's active «Partide» already names the page (owner 2026-10-13: «de ce
      // duplicăm titlul?»): the h1 stays for assistive tech and SEO, visually hidden. The phone keeps
      // fish's header (no top bar there).
      className="md:sr-only"
      title="Partide"
      actions={
        // Per-user: nothing until the session and the live probe have answered (owner rule 4).
        <Suspense fallback={null}>
          <StartPill />
        </Suspense>
      }
    />
  );
}

/**
 * c1 — «Începe»: no live partidă confirmed (or a guest). Starting a partidă is app-only on web (owner
 * 2026-10-08, ROADMAP §4b rule 21): the pill is the universal link into the app's start flow, below
 * 1280 only — a desktop gets the hero's store links instead (a universal link would land back here).
 */
function StartPill() {
  const viewer = usePartideViewer();
  if (viewer.kind === 'pending') return null;
  if (viewer.kind === 'viewer' && viewer.active !== null) return null;
  return (
    <a
      href={appLinks.startPartida()}
      aria-label="Începe o partidă în aplicația Bluvi"
      className={buttonClass({ variant: 'primary', size: 'compact', className: 'shadow-glow xl:hidden' })}
      data-testid="start-pill"
    >
      <PlusIcon aria-hidden className="size-4" />
      Începe
    </a>
  );
}

/** The pinned tab bar's height, for a row that pins under it (PARTIDE_UNDER_TABS_TOP). */
export const PARTIDE_TABS_H_VAR = '--partide-tabs-h';

/** Under the shell's top bar from 768 (h-16), at the top edge on the phone; below the offline banner. */
const TABS_TOP = 'top-[var(--shell-banner-h,0px)] md:top-[calc(--spacing(16)_+_var(--shell-banner-h,0px))]';

/** `top` of a row pinned under the tab bar. */
export const PARTIDE_UNDER_TABS_TOP =
  'top-[calc(var(--shell-banner-h,0px)_+_var(--partide-tabs-h,0px))] md:top-[calc(--spacing(16)_+_var(--shell-banner-h,0px)_+_var(--partide-tabs-h,0px))]';

/** c2 — the hub's tabs. `current` is the page's own tab. */
export function PartideTabs({ current }: { current: PartideTab }) {
  const ref = useRef<HTMLElement>(null);
  usePinned(ref);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => root.style.setProperty(PARTIDE_TABS_H_VAR, `${Math.round(el.offsetHeight)}px`));
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty(PARTIDE_TABS_H_VAR);
    };
  }, []);
  const tabs = TABS.flatMap(tab => {
    const href = tab.href();
    return href ? [{ ...tab, href }] : [];
  });
  if (tabs.length < 2) return null;
  return (
    // From 768 centred under the top bar, Airbnb's category tabs (owner 2026-10-13), on the hairline.
    <nav
      ref={ref}
      aria-label="Partide"
      className={cn('sticky z-sticky -mx-4 bg-page px-4 max-md:-mt-1 md:-mx-6 md:px-6 md:pt-2 xl:-mx-8 xl:px-8', TABS_TOP)}
    >
      <ul className="flex gap-1 border-b border-hairline md:justify-center md:gap-8">
        {tabs.map(({ href, ...tab }) => {
          const active = tab.value === current;
          const cls = cn(
            'relative -mb-px flex min-h-11 items-center rounded-t-control px-2.5 t-body-strong transition-colors duration-(--duration-fast) md:min-h-13 md:t-heading',
            'after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.75 after:rounded-full',
            active ? 'text-accent-ink after:bg-accent' : 'text-muted',
          );
          return (
            <li key={tab.value}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                onClick={
                  active
                    ? e => {
                        // fish: re-tapping the open tab scrolls its scene back to the top.
                        e.preventDefault();
                        window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
                      }
                    : undefined
                }
                className={cn(
                  cls,
                  !active && 'hover:bg-soft-fill hover:text-ink hover:after:bg-hairline',
                  'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                )}
                data-testid={`tab-${tab.value}`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
