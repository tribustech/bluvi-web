import type { ReactNode } from 'react';
import { BellAlertIcon, SignalSlashIcon } from '@heroicons/react/24/outline';
import { ScaleIcon } from '@/components/icons/brand';
import { FishLogo } from '@/components/nav/brand';
import { cn } from '@/components/ui/cn';
import { APP_STORE, PLAY_STORE } from '@/lib/app-links';
import { AppleGlyph, GooglePlayGlyph } from './StoreGlyphs';

/**
 * From 768, the column's last row — «La baltă, partida se ține în aplicație» (web only; the app
 * has no equivalent): what the phone does that the web does not, and the two store links. One band
 * across the column (owner 2026-10-13, «Acasă într-o coloană»: the app is promoted once, in the
 * Bluvi light palette — accent-tint, never the dark navy card). Copy on the left, the stores on the
 * right; under 1024 the stores drop below the copy. The feature glyphs are the 24 outline set at
 * its own size (§05), the brand scale at the same 24.
 */
export function AppBand({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="acasa-aplicatia"
      className={cn(
        'relative isolate flex flex-col gap-6 overflow-hidden rounded-bento border border-accent-tint-2 p-7 lg:flex-row lg:items-center lg:justify-between xl:px-10 xl:py-9',
        'bg-[linear-gradient(120deg,var(--color-accent-tint)_0%,var(--color-surface)_75%)]',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-control bg-accent text-on-accent shadow-glow">
            <FishLogo className="size-6" />
          </span>
          <h2 id="acasa-aplicatia" className="t-title1 text-ink">
            La baltă, partida se ține în aplicație
          </h2>
        </div>
        <ul className="grid gap-x-8 gap-y-2 t-body text-ink-2 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <Feature icon={<BellAlertIcon aria-hidden className="size-6 shrink-0 text-accent-ink" />}>Notificare când începe cântarul la standul tău</Feature>
          <Feature icon={<ScaleIcon size={24} className="shrink-0 text-accent-ink" />}>Cântar și clasament live, direct de pe mal</Feature>
          <Feature icon={<SignalSlashIcon aria-hidden className="size-6 shrink-0 text-accent-ink" />}>Partidele merg și fără semnal</Feature>
        </ul>
      </div>
      <div className="flex shrink-0 flex-wrap gap-3">
        <StoreLink href={APP_STORE} kicker="Descarcă din" store="App Store" glyph={<AppleGlyph className="size-5" />} />
        <StoreLink href={PLAY_STORE} kicker="Disponibil pe" store="Google Play" glyph={<GooglePlayGlyph className="size-4.5" />} />
      </div>
    </section>
  );
}

function Feature({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      {icon}
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/**
 * A store badge: accent-ink (not the accent: white on it is under AA at this size), the store's
 * two-line label, the kit's hover / press / focus.
 */
function StoreLink({ href, kicker, store, glyph }: { href: string; kicker: string; store: string; glyph: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex h-14 items-center gap-2.5 rounded-control bg-accent-ink px-5 text-surface shadow-e1 transition-[opacity,transform] duration-(--duration-fast) ease-fast hover:-translate-y-0.5 active:translate-y-0 active:opacity-80 motion-reduce:hover:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
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
