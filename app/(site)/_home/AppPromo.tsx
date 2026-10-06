import type { ReactNode } from 'react';
import { BellAlertIcon, SignalSlashIcon } from '@heroicons/react/24/outline';
import { ScaleIcon } from '@/components/icons/brand';
import { FishLogo } from '@/components/nav/brand';
import { DashboardSection } from '@/components/templates/T5';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { ON_DARK_FOCUS } from './PartidaCta';
import { AppleGlyph, GooglePlayGlyph } from './StoreGlyphs';

// bluvi-redirect-stores: the store listings the app's universal links fall back to.
const APP_STORE = 'https://apps.apple.com/ro/app/bluvi-aplicatia-pescarilor/id6743083184';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.tribustech.bluvi';

/**
 * From 1280, the main column's last block, beside the feedback card — «Ia Bluvi pe baltă» (design only — the app has no equivalent): what the
 * phone does that the web does not, and the two store links. The design's QR tile is a placeholder
 * and is left out until there is a real code to show; without it the design's stacked buttons
 * (a column beside the QR) would leave half the card empty, so from a 320px card (@xs) they sit
 * side by side; a narrower card stacks them, one full-width row each: a store name is never
 * truncated. The feature bullets are UI glyphs: the 24 outline set at its own
 * size (§05), the brand scale at the same 24.
 */
export function AppPromo({ className }: { className?: string }) {
  return (
    // The T5 card on its navy tone: white heading, lavender-3 for the secondary copy only.
    <DashboardSection
      variant="card"
      tone="navy"
      className={cn('@container h-full flex flex-col [&>:last-child]:flex [&>:last-child]:flex-1 [&>:last-child]:flex-col', className)}
      title={
        <span className="flex items-center gap-3">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-control bg-accent text-on-accent">
            <FishLogo className="size-6" />
          </span>
          <span className="flex flex-col">
            <span aria-hidden className="t-eyebrow text-lavender-2 uppercase">
              Aplicația Bluvi
            </span>
            Ia Bluvi pe baltă
          </span>
        </span>
      }
    >
      <ul className="flex flex-col gap-2 t-label text-lavender-3">
        <li className="flex items-center gap-2.5">
          <BellAlertIcon aria-hidden className="size-6 shrink-0 text-lavender-3" />
          Notificări când începe cântarul la standul tău
        </li>
        <li className="flex items-center gap-2.5">
          <ScaleIcon size={24} className="shrink-0 text-lavender-3" />
          Cântar și clasament live, direct de pe mal
        </li>
        <li className="flex items-center gap-2.5">
          <SignalSlashIcon aria-hidden className="size-6 shrink-0 text-lavender-3" />
          Partide care merg și fără semnal
        </li>
      </ul>
      <div className="mt-auto flex flex-col gap-2 pt-3.5 @xs:flex-row">
        <StoreLink href={APP_STORE} kicker="Descarcă din" store="App Store" glyph={<AppleGlyph className="size-4.5" />} />
        <StoreLink href={PLAY_STORE} kicker="Disponibil pe" store="Google Play" glyph={<GooglePlayGlyph className="size-4" />} />
      </div>
    </DashboardSection>
  );
}

/** The kit outline button at the kit heights (48 / 40), with the store's two-line label. */
function StoreLink({ href, kicker, store, glyph }: { href: string; kicker: string; store: string; glyph: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: 'outline', className: `min-w-0 flex-1 ${ON_DARK_FOCUS}` })}>
      <span aria-hidden className="flex size-5 shrink-0 items-center justify-center text-ink">
        {glyph}
      </span>
      <span className="flex flex-col text-left">
        <span className="t-micro text-ink-2">{kicker}</span>
        <span className="t-control text-ink">{store}</span>
      </span>
      <span className="sr-only"> (se deschide într-o filă nouă)</span>
    </a>
  );
}
