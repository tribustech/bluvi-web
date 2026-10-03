import type { ReactNode } from 'react';
import { BellAlertIcon, SignalSlashIcon } from '@heroicons/react/20/solid';
import { ScaleIcon } from '@/components/icons/brand';
import { FishLogo } from '@/components/nav/brand';
import { AppleGlyph, GooglePlayGlyph } from './StoreGlyphs';

// bluvi-redirect-stores: the store listings the app's universal links fall back to.
const APP_STORE = 'https://apps.apple.com/ro/app/bluvi-aplicatia-pescarilor/id6743083184';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.tribustech.bluvi';

/**
 * Desktop right column, «Ia Bluvi pe baltă» (design only — the app has no equivalent): what the
 * phone does that the web does not, and the two store links. The design's QR tile is a placeholder
 * and is left out until there is a real code to show; without it the design's stacked buttons
 * (a column beside the QR) would leave half the card empty, so they sit side by side — deliberate.
 */
export function AppPromo() {
  return (
    <section aria-labelledby="acasa-aplicatia" className="relative isolate flex flex-col gap-3.5 overflow-hidden rounded-[18px] bg-navy p-[18px]">
      <span aria-hidden className="absolute -top-7 -right-7 -z-10 size-[120px] rounded-full bg-lavender/5" />
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="flex size-10 items-center justify-center rounded-[11px] bg-accent text-on-accent">
          <FishLogo className="size-[26px]" />
        </span>
        <div>
          <p className="t-eyebrow tracking-[1px] text-lavender-2">APLICAȚIA BLUVI</p>
          <h2 id="acasa-aplicatia" className="t-heading text-lavender">
            Ia Bluvi pe baltă
          </h2>
        </div>
      </div>
      <ul className="flex flex-col gap-2 t-label text-lavender-3">
        <li className="flex items-center gap-2.5">
          <BellAlertIcon aria-hidden className="size-4 shrink-0 text-lavender" />
          Notificări când începe cântarul la standul tău
        </li>
        <li className="flex items-center gap-2.5">
          <ScaleIcon size={16} className="shrink-0 text-lavender" />
          Cântar și clasament live, direct de pe mal
        </li>
        <li className="flex items-center gap-2.5">
          <SignalSlashIcon aria-hidden className="size-4 shrink-0 text-lavender" />
          Partide care merg și fără semnal
        </li>
      </ul>
      <div className="flex gap-2">
        <StoreLink href={APP_STORE} kicker="Descarcă din" store="App Store" glyph={<AppleGlyph className="size-[18px]" />} />
        <StoreLink href={PLAY_STORE} kicker="Disponibil pe" store="Google Play" glyph={<GooglePlayGlyph className="size-4" />} />
      </div>
    </section>
  );
}

function StoreLink({ href, kicker, store, glyph }: { href: string; kicker: string; store: string; glyph: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-[42px] min-w-0 flex-1 items-center gap-2 rounded-control bg-photo-chip px-3 text-ink hover:opacity-90"
    >
      <span className="flex size-[18px] shrink-0 items-center justify-center text-ink">{glyph}</span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate t-micro text-ink-2">{kicker}</span>
        <span className="truncate t-control">{store}</span>
      </span>
      <span className="sr-only"> (se deschide într-o filă nouă)</span>
    </a>
  );
}
