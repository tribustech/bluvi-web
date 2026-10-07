'use client';

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import Image, { type StaticImageData } from 'next/image';
import Link from 'next/link';
import { ArrowPathIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { myWidgetNotificationQuery, registerWidgetNotificationMutation, widgetNotificationKeys, type FeatureKey } from '@/core/social';
import { createBrowserTransport } from '@/lib/client/transport';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { CountBadge, DashboardSection } from '@/components/templates/T5';
import { Button, ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { StatusPill } from '@/components/ui/StatusPill';
import { useSiteToast } from '../_shell/Toast';
import { useViewerState } from '../_shell/viewer-context';
import { BOOKINGS_NEW_BADGE_UNTIL, BOOKINGS_NOU_KEY, markBookingsVisited } from '@/lib/bookings-nou';
import { homeLinks } from './links';
import rezervari from './assets/rezervari_widget.webp';
import vremea from './assets/vremea_widget.webp';
import fazeleLunii from './assets/fazele_lunii.webp';


/** `ready`: the registered line, agreed with the feature's name (fish's `{title} e disponibil` is not). */
type Interest = { feature: FeatureKey; title: string; description: string; ready: string; image: StaticImageData };

// fish WidgetsList INTEREST. Its `jurnalPartide` entry has no tile in fish (Partide is live, the
// start-partidă hero is its entry point), so it has none here either.
const WEATHER: Interest = {
  feature: 'weather',
  title: 'Vremea',
  description: 'Prognoza meteo pentru spoturile tale de pescuit — vânt, presiune, temperatură și precipitații. Lucrăm la asta!',
  ready: 'Te anunțăm imediat ce Vremea e disponibilă.',
  image: vremea,
};
const MOON: Interest = {
  feature: 'moonPhases',
  title: 'Fazele Lunii',
  description: 'Urmărește fazele lunii și cele mai bune momente pentru pescuit. Lucrăm la asta!',
  ready: 'Te anunțăm imediat ce Fazele Lunii sunt disponibile.',
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
            onClick={markBookingsVisited}
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
        // An informational, dismissible offer (fish: a plain sheet, pan-down and backdrop close):
        // a fitted sheet below 768, a plain dialog with «Închide» from 768 — never an alert.
        intent="info"
        sheetSnap="fit"
        // The body shows the name centred under the artwork (fish title1); the header keeps it
        // for the dialog's accessible name only.
        titleHidden
        title={interest?.title ?? ''}
        actions={
          interest ? (
            <Suspense fallback={<BusyNotifyButton />}>
              <InterestAction interest={interest} onClose={() => setInterest(null)} />
            </Suspense>
          ) : null
        }
      >
        {interest ? (
          <Suspense fallback={<InterestBody interest={interest} registered={false} />}>
            <InterestBodyFor interest={interest} />
          </Suspense>
        ) : null}
      </ResponsiveSurface>
    </DashboardSection>
  );
}

/**
 * The session as the interest panel needs it: a known guest, or a session (signed in, or unknown —
 * a cookie whose read failed; the GET and POST carry it, and a dead one answers 401 → «not
 * registered» / the error toast). An unknown session is never shown the guest's «Intră în cont».
 */
function useInterestNotification(feature: FeatureKey) {
  const signedOut = useViewerState() === null;
  const t = useMemo(() => createBrowserTransport(), []);
  const mine = useQuery(myWidgetNotificationQuery(t, feature, { isAuthenticated: !signedOut }));
  return { signedOut, t, mine, registered: !!mine.data?.registered };
}

/** fish WidgetNotificationSheet body: the artwork + description, or the check + «Ești pe listă!». */
function InterestBodyFor({ interest }: { interest: Interest }) {
  const { registered } = useInterestNotification(interest.feature);
  return <InterestBody interest={interest} registered={registered} />;
}

/**
 * One centred axis, as fish: the 64px artwork (or the check), the name in t-title1 — the focal
 * point — then the description. The name is the surface's title for assistive tech (visually
 * hidden there), so here it is aria-hidden: read once.
 */
function InterestBody({ interest, registered }: { interest: Interest; registered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 pt-1 text-center">
      <div className="flex flex-col items-center gap-1.5">
        {registered ? (
          <CheckCircleIcon aria-hidden className="size-16 text-success" />
        ) : (
          <Image src={interest.image} alt="" className="size-16 rounded-card object-cover" />
        )}
        <p aria-hidden className="t-title1 text-ink">
          {interest.title}
        </p>
      </div>
      <p className="t-body text-muted" aria-live="polite">
        {registered ? `Ești pe listă! 🎉 ${interest.ready}` : interest.description}
      </p>
    </div>
  );
}

/**
 * fish WidgetNotificationSheet actions: signed out → «Intră în cont» (sign-in returns to Acasă);
 * signed in → «Anunță-mă când e disponibil» (POST, idempotent), once registered → «Închide»; a failed
 * save toasts fish's «Nu am putut salva. Încearcă din nou.» and keeps the panel open. While the
 * «am I registered?» read is in flight the button waits disabled (never an offer that may flip to
 * «Ești pe listă» a moment later): a spinner, aria-busy, then the offer — a failed read (500) falls
 * through to the offer at once (the read does not retry: web divergence, home.acasa.c18).
 */
function InterestAction({ interest, onClose }: { interest: Interest; onClose: () => void }) {
  const { signedOut, t, mine, registered } = useInterestNotification(interest.feature);
  const qc = useQueryClient();
  const toast = useSiteToast();
  const register = useMutation(registerWidgetNotificationMutation(t, qc, interest.feature));

  if (signedOut) {
    return (
      <ButtonLink href={homeLinks.signIn} block>
        Intră în cont
      </ButtonLink>
    );
  }
  // ONE Button across busy / offer / registered — only its label, variant and press change — so the
  // focused node survives the save: a keyboard / screen-reader user stays in the dialog, on «Închide».
  const busy = !registered && (mine.isPending || register.isPending);
  return (
    <Button
      block
      variant={registered ? 'secondary' : 'primary'}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      className={cn(busy && 'opacity-60')}
      onClick={() => {
        if (registered) return onClose();
        if (busy) return;
        register.mutate(undefined, {
          // The answer already says so: show «Ești pe listă» now, not after the invalidated read.
          onSuccess: (r) => qc.setQueryData(widgetNotificationKeys.mine(r.feature), { feature: r.feature, registered: true, registeredAt: r.registeredAt }),
          onError: () => toast('Nu am putut salva. Încearcă din nou.', 'danger'),
        });
      }}
    >
      <NotifyLabel busy={busy} label={registered ? 'Închide' : register.isPending ? 'Se salvează…' : 'Anunță-mă când e disponibil'} />
    </Button>
  );
}

/** The Suspense placeholder of the offer's CTA: busy (spinner, aria-busy, aria-disabled). */
function BusyNotifyButton() {
  return (
    <Button block aria-disabled aria-busy className="opacity-60">
      <NotifyLabel busy label="Anunță-mă când e disponibil" />
    </Button>
  );
}

function NotifyLabel({ busy, label }: { busy: boolean; label: string }) {
  return (
    <>
      {busy ? <ArrowPathIcon aria-hidden className="size-5 shrink-0 animate-spin motion-reduce:animate-none" /> : null}
      {label}
    </>
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
