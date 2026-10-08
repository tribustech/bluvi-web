'use client';

import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { PlusIcon } from '@heroicons/react/20/solid';
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
 *    has NO live partidă (c1), and into the app (owner 2026-10-08) — and the page's refresh control;
 *  - under it the underline tabs (c2): Comunitate · Explorează · Ale mele, each its own URL, so the
 *    choice is never persisted (c3: /partide always opens on Comunitate). Owner rule 20: one bar on
 *    a hairline, the active tab in the accent ink on a 2.5px underline, hover and focus states.
 *    Re-selecting the active tab scrolls back to the top (fish handleSubTabChange). A tab whose page
 *    is not on the web yet is left out (an inert tab reads as broken on touch — fish never has a dead
 *    tap), and while «Comunitate» would be alone there is no tab bar at all. Owner rule 3: the bar is
 *    part of the page — it scrolls with it, it never floats.
 */

export type PartideTab = 'comunitate' | 'exploreaza' | 'ale-mele';

const TABS: { value: PartideTab; label: string; href: () => string | null }[] = [
  { value: 'comunitate', label: 'Comunitate', href: () => routes.partide() },
  { value: 'exploreaza', label: 'Explorează', href: () => partideHrefs.explore() },
  { value: 'ale-mele', label: 'Ale mele', href: () => partideHrefs.mine() },
];

export function PartideHeader({ actions }: { actions?: ReactNode }) {
  return (
    <DashboardHeader
      title="Partide"
      actions={
        <>
          {/* Per-user: nothing until the session and the live probe have answered (owner rule 4). */}
          <Suspense fallback={null}>
            <StartPill />
          </Suspense>
          {actions}
        </>
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

/** c2 — the hub's tabs. `current` is the page's own tab. */
export function PartideTabs({ current }: { current: PartideTab }) {
  const tabs = TABS.flatMap(tab => {
    const href = tab.href();
    return href ? [{ ...tab, href }] : [];
  });
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Partide" className="max-md:-mt-1">
      <ul className="flex gap-1 border-b border-hairline md:gap-2">
        {tabs.map(({ href, ...tab }) => {
          const active = tab.value === current;
          const cls = cn(
            'relative -mb-px flex min-h-11 items-center rounded-t-control px-2.5 t-body-strong transition-colors duration-(--duration-fast)',
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
