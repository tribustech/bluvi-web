'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import Image, { type StaticImageData } from 'next/image';
import Link from 'next/link';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { CountBadge, DashboardSection } from '@/components/templates/T5';
import { Button, ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { StatusPill } from '@/components/ui/StatusPill';
import { useViewerState } from '../_shell/viewer-context';
import { homeLinks } from './links';
import rezervari from './assets/rezervari_widget.webp';
import vremea from './assets/vremea_widget.webp';
import fazeleLunii from './assets/fazele_lunii.webp';

// fish hooks/useNouBadge.ts — the «NOU» pill shows before the launch deadline and until the
// first visit of Rezervări.
const BOOKINGS_NOU_KEY = '@bluvi/bookings/visited/v1';
const BOOKINGS_NEW_BADGE_UNTIL = Date.UTC(2026, 9, 1);

type Interest = { title: string; description: string; image: StaticImageData };

// fish WidgetsList INTEREST
const WEATHER: Interest = {
  title: 'Vremea',
  description: 'Prognoza meteo pentru spoturile tale de pescuit — vânt, presiune, temperatură și precipitații. Lucrăm la asta!',
  image: vremea,
};
const MOON: Interest = {
  title: 'Fazele Lunii',
  description: 'Urmărește fazele lunii și cele mai bune momente pentru pescuit. Lucrăm la asta!',
  image: fazeleLunii,
};

/**
 * fish components/WidgetsList.tsx — «Instrumente»: Rezervări (count of upcoming bookings, «NOU»
 * pill), Vremea and Fazele Lunii («În curând», open the interest sheet). Below 1280: 64px tiles
 * centred on equal thirds of a surface card under a plain section title — one container from the
 * phone to the tablet, on the grid of the operator shortcut bar above it, so the icon rows line up.
 * There a state pill hangs fully under its tile (never over the artwork), in a band every tile
 * keeps, so all three captions share one baseline, pill or not. Desktop right column (320–360px):
 * a T5 card with three 56px tiles, the SAME pill hung under the tile (each tile's third is ~90px,
 * the pill fits) — one state idiom at every width. Never a corner dot: that is the unread-count
 * idiom (CountBadge, the bell), kept for real counts. A coming-soon tile is faded to .7 —
 * still legible artwork, plainly not yet live. Captions are t-caption ink-2 at every width.
 */
export function Widgets({ layout, bookingsBadge }: { layout: 'mobile' | 'desktop'; bookingsBadge?: ReactNode }) {
  const [interest, setInterest] = useState<Interest | null>(null);
  const [showNou, setShowNou] = useState(false);
  const desktop = layout === 'desktop';

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads storage once after hydration
      setShowNou(Date.now() < BOOKINGS_NEW_BADGE_UNTIL && localStorage.getItem(BOOKINGS_NOU_KEY) !== '1');
    } catch {
      // Storage unavailable — no badge rather than a badge that never goes away.
    }
  }, []);

  const tile = desktop ? 'size-14 rounded-card' : 'size-16 rounded-card';
  const cell = 'flex flex-col items-center';
  // 36 = 4 of air, the 26px pill, 6 to the caption — at every width, so the captions share a baseline.
  const target = 'group flex flex-col items-center gap-9 rounded-control outline-offset-4 active:opacity-70';
  const caption = 'text-center t-caption text-ink-2 group-hover:text-ink';

  return (
    <DashboardSection variant={desktop ? 'card' : 'plain'} title="Instrumente">
      <ul
        className={cn(
          desktop ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-3 justify-items-center gap-2 rounded-card bg-surface p-4.5 shadow-e0'
        )}
      >
        <li className={cell}>
          <Link
            href={homeLinks.myBookings}
            onClick={() => {
              try {
                localStorage.setItem(BOOKINGS_NOU_KEY, '1');
              } catch {}
            }}
            className={target}
          >
            <span className={cn('relative block', tile)}>
              <Image src={rezervari} alt="" className={cn('size-full object-cover', tile)} />
              {bookingsBadge}
              {showNou ? <TilePill tone="info">NOU</TilePill> : null}
            </span>
            <span className={caption}>Rezervări</span>
          </Link>
        </li>
        {[WEATHER, MOON].map((w) => (
          <li key={w.title} className={cell}>
            <button type="button" onClick={() => setInterest(w)} className={target} aria-label={`${w.title}, în curând`}>
              <span className={cn('relative block', tile)}>
                <Image src={w.image} alt="" className={cn('size-full object-cover opacity-70', tile)} />
                <TilePill tone="warning">În curând</TilePill>
              </span>
              <span className={caption}>{w.title}</span>
            </button>
          </li>
        ))}
      </ul>

      <ResponsiveSurface
        open={interest !== null}
        onClose={() => setInterest(null)}
        intent="decision"
        title={interest?.title ?? ''}
        actions={
          <Suspense fallback={null}>
            <InterestAction onClose={() => setInterest(null)} />
          </Suspense>
        }
      >
        {interest ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <Image src={interest.image} alt="" className="size-20 rounded-card object-cover" />
            <p className="t-body text-muted">{interest.description}</p>
          </div>
        ) : null}
      </ResponsiveSurface>
    </DashboardSection>
  );
}

/**
 * fish WidgetNotificationSheet: signed out → «Intră în cont»; signed in → «Anunță-mă când e
 * disponibil». The register endpoint is not in core/ yet, so signed in only closes for now.
 */
function InterestAction({ onClose }: { onClose: () => void }) {
  // Only a known signed-out visitor is sent to sign in (an unknown session is never a guest).
  if (useViewerState() === null) {
    return (
      <ButtonLink href={homeLinks.signIn} block>
        Intră în cont
      </ButtonLink>
    );
  }
  return (
    <Button variant="secondary" block onClick={onClose}>
      Închide
    </Button>
  );
}

/** A state hung 4px under its tile (StatusPill: «NOU», «În curând»), centred on the tile. */
function TilePill({ tone, children }: { tone: 'info' | 'warning'; children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute inset-x-0 top-full mt-1 flex justify-center">
      <StatusPill tone={tone}>{children}</StatusPill>
    </span>
  );
}

/** The count on the Rezervări tile (fish `badge`, top-right): the T5 corner badge. */
export function BookingsBadge({ count }: { count: number | null }) {
  if (!count) return null;
  return (
    <>
      <CountBadge count={count} className="absolute -top-1 -right-1" />
      <span className="sr-only">, {count > 99 ? '99+' : count} rezervări viitoare</span>
    </>
  );
}
