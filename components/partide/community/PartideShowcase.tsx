import Link from 'next/link';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { ChartBarIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { PartideDemo } from './PartideDemo';
import { cn } from '@/components/ui/cn';
import { APP_STORE, PLAY_STORE } from '@/lib/app-links';
import { AppleGlyph, GooglePlayGlyph } from '@/app/(site)/_home/StoreGlyphs';

/*
 * Partide › Comunitate from 768, for a viewer with no live partidă (owner 2026-10-13: «măcar să
 * prezentăm ce face zona de partide, că poți să înregistrezi, că ai cronometre… nu vedem nimic»).
 * What a partidă is, in the app's own terms: the four things it does, the two ways in (the stores),
 * and the community's own numbers one click away (Statistici, Clasamente). Running a partidă is
 * app-only on the web (owner 2026-10-08, ROADMAP §4b rule 21), so the actions are the stores.
 * Light palette (owner 2026-10-13: no dark blocks): accent-tint wash with slow water along its foot.
 * The four features play as a demo on a drawn phone (PartideDemo, owner 2026-10-13 option A).
 */

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export function PartideShowcase({ stats, ranking, className }: { stats: string | null; ranking: string | null; className?: string }) {
  return (
    <section
      aria-labelledby="partide-prezentare"
      data-testid="partide-showcase"
      className={cn(
        'relative isolate overflow-hidden rounded-bento border border-accent-tint-2 p-8 xl:px-12 xl:py-10',
        'bg-[linear-gradient(125deg,var(--color-accent-tint)_0%,var(--color-surface)_62%)]',
        className,
      )}
    >
      <Water />
      <PartideDemo
        intro={
          <div className="flex flex-col gap-4">
            <h2 id="partide-prezentare" className="t-display text-balance text-ink">
              Partida ta, de la prima lansetă la ultima captură
            </h2>
            <p className="max-w-150 t-body text-ink-2">
              Pornești partida în aplicația Bluvi și ai totul într-un loc: lansete, capturi, timp și prieteni. Aici vezi ce
              prinde comunitatea, în timp real.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <StoreLink href={APP_STORE} kicker="Descarcă din" store="App Store" glyph={<AppleGlyph className="size-5" />} />
              <StoreLink href={PLAY_STORE} kicker="Disponibil pe" store="Google Play" glyph={<GooglePlayGlyph className="size-4.5" />} />
              {stats ? <TextLink href={stats} Icon={ChartBarIcon}>Statistici</TextLink> : null}
              {ranking ? <TextLink href={ranking} Icon={TrophyIcon}>Clasamente</TextLink> : null}
            </div>
          </div>
        }
      />
    </section>
  );
}

/** The band's slow water: two wave lines drifting along its bottom edge (still under reduced motion). */
function Water() {
  const wave = 'M0 30 Q 75 10 150 30 T 300 30 T 450 30 T 600 30 T 750 30 T 900 30 T 1050 30 T 1200 30';
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-behind h-40 overflow-hidden text-accent opacity-[0.14]">
      <svg viewBox="0 0 1200 60" preserveAspectRatio="none" className="absolute bottom-10 h-16 w-[200%] motion-safe:animate-drift">
        <path d={wave} fill="none" stroke="currentColor" strokeWidth="2" />
        <path d={wave} transform="translate(600 0)" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <svg viewBox="0 0 1200 60" preserveAspectRatio="none" className="absolute bottom-2 h-16 w-[200%] motion-safe:animate-drift [animation-duration:26s]">
        <path d={wave} transform="translate(0 8)" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d={wave} transform="translate(600 8)" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    </div>
  );
}

function TextLink({ href, Icon, children }: { href: string; Icon: Icon; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="ml-2 inline-flex min-h-11 items-center gap-2 rounded-control t-body-strong text-accent-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Icon aria-hidden className="size-5" />
      {children}
    </Link>
  );
}

/** A store badge: accent-ink, the store's two-line label (white on the accent is under AA here). */
function StoreLink({ href, kicker, store, glyph }: { href: string; kicker: string; store: string; glyph: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-14 items-center gap-2.5 rounded-control bg-accent-ink px-5 text-surface shadow-e1 transition-[opacity,transform] duration-(--duration-fast) ease-fast hover:-translate-y-0.5 active:translate-y-0 active:opacity-80 motion-reduce:hover:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span aria-hidden className="flex size-5 shrink-0 items-center justify-center">
        {glyph}
      </span>
      <span className="flex flex-col text-left">
        <span className="t-micro opacity-85">{kicker}</span>
        <span className="t-control">{store}</span>
      </span>
      <span className="sr-only"> (se deschide într-o filă nouă)</span>
    </a>
  );
}
