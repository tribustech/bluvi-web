'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import Image, { type StaticImageData } from 'next/image';
import Link from 'next/link';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Button, ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { useViewer } from '../_shell/viewer-context';
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
 * pill), Vremea and Fazele Lunii («În curând», open the interest sheet). Mobile: a row of 64px
 * tiles; desktop right column: a card with three 56px tiles (design).
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

  const tile = desktop ? 'size-14 rounded-[14px]' : 'size-16 rounded-card';

  return (
    <section
      aria-labelledby={`acasa-instrumente-${layout}`}
      className={cn('flex flex-col', desktop && 'gap-2.5 rounded-card bg-surface p-3.5')}
    >
      <h2 id={`acasa-instrumente-${layout}`} className={desktop ? 't-heading' : 't-title2'}>
        Instrumente
      </h2>
      <ul className={cn(desktop ? 'grid grid-cols-3 gap-2' : 'my-2.5 flex gap-2.5')}>
        <li className={cn('flex flex-col items-center gap-1.5', !desktop && 'w-21')}>
          <Link
            href={homeLinks.myBookings}
            onClick={() => {
              try {
                localStorage.setItem(BOOKINGS_NOU_KEY, '1');
              } catch {}
            }}
            className="group flex flex-col items-center gap-1.5 rounded-control outline-offset-4"
          >
            <span className={cn('relative block', tile)}>
              <Image src={rezervari} alt="" className={cn('size-full object-cover', tile)} />
              {bookingsBadge}
              {showNou ? <Pill className="bg-live text-on-accent">NOU</Pill> : null}
            </span>
            <span className={cn('text-center text-muted group-hover:text-ink', desktop ? 't-caption' : 't-body')}>Rezervări</span>
          </Link>
        </li>
        {[WEATHER, MOON].map((w) => (
          <li key={w.title} className={cn('flex flex-col items-center', !desktop && 'w-21')}>
            <button
              type="button"
              onClick={() => setInterest(w)}
              className="group flex flex-col items-center gap-1.5 rounded-control outline-offset-4"
              aria-label={`${w.title}, în curând`}
            >
              <span className={cn('relative block', tile)}>
                <Image src={w.image} alt="" className={cn('size-full object-cover opacity-55', tile)} />
                {/* Dark ink on yellow (≈9.7:1); white on yellow-5 is 1.9:1. */}
                <Pill className="bg-yellow-5 text-ink">În curând</Pill>
              </span>
              <span className={cn('text-center text-muted group-hover:text-ink', desktop ? 't-caption' : 't-body')}>{w.title}</span>
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
    </section>
  );
}

/**
 * fish WidgetNotificationSheet: signed out → «Intră în cont»; signed in → «Anunță-mă când e
 * disponibil». The register endpoint is not in core/ yet, so signed in only closes for now.
 */
function InterestAction({ onClose }: { onClose: () => void }) {
  const viewer = useViewer();
  if (!viewer) {
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

function Pill({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute inset-x-[-6px] -bottom-1 flex justify-center">
      <span className={cn('rounded-lg px-1.5 py-0.5 t-label whitespace-nowrap shadow-button', className)}>{children}</span>
    </span>
  );
}

/** The count on the Rezervări tile (fish `badge`, indigo, top-right). */
export function BookingsBadge({ count }: { count: number | null }) {
  if (!count) return null;
  return (
    <span className="absolute -top-1 -right-1 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-accent px-1.5 t-label text-on-accent">
      {count > 99 ? '99+' : count}
      <span className="sr-only"> rezervări viitoare</span>
    </span>
  );
}
