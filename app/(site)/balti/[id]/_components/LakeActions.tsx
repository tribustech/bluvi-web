'use client';

import Link from 'next/link';
import { createContext, Suspense, use, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { CalendarDaysIcon, GlobeAltIcon, ShareIcon } from '@heroicons/react/24/outline';
import { headerChipClass, type HeaderChipGround } from '@/components/templates/T3';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import {
  lakeBookingAction,
  parseRecentViewedLakeIds,
  pushRecentViewedLakeId,
  RECENT_VIEWED_LAKE_IDS_KEY,
  type LakeBookingInterestSource,
  type LakeBookingState,
} from '@/core/lakes';
import type { RichTextNode } from '@/core/shared';
import { routes } from '@/lib/routes';
import { useViewerState, type ViewerState } from '../../../_shell/viewer-context';
import { userOf } from '../../../_shell/viewer-state';
import { track } from './analytics';
import { lakeHref } from './availability';
import { CLAIM_PARAM, CLAIM_VALUE, claimReturnPath, LakeDialogs, type LakeDialog } from './LakeDialogs';
import { bookingReachable } from './bookingReach';
import { onSectionJump } from './SectionLink';

/*
 * The lake page's client half — fish [lakeId].tsx owns its sheets (share, directions, reviews
 * explainer, description, claim, booking interest) and the booking affordance at the screen level,
 * so the hero, the title block, the quick actions and the pinned nav all reach the same ones. The
 * web does the same: one provider around the server-rendered page, small trigger buttons where the
 * page needs them, and the dialogs mounted once (on first open).
 *
 * The session: the shell's tri-state read (viewer-context), probed once behind its own Suspense
 * so nothing on the page waits for it. It never changes what the page renders (the booking controls
 * look the same for everyone); it only decides where a click goes (useBookingTarget's href,
 * ClaimTrigger, the dialogs' submits).
 */

export type LakeInfo = {
  documentId: string;
  name: string;
  coordinates: { lat: string; long: string } | null;
  bookingState: LakeBookingState;
  /** The full description, for the «Vezi mai mult» dialog (lakes.detail.c13). */
  description?: RichTextNode[] | null;
  /** The first contact phone: a phone-booking lake books through it (bookingReach.ts). */
  phone?: string | null;
  /** The lake's website: the way to reach a phone-booking lake that lists no phone. */
  website?: string | null;
};

/** null: signed out · user · unknown · undefined: not answered yet. */
type Session = ViewerState | undefined;

type Ctx = {
  lake: LakeInfo;
  session: Session;
  open: (dialog: LakeDialog, source?: LakeBookingInterestSource) => void;
};

const LakeContext = createContext<Ctx | null>(null);

export function useLake(): Ctx {
  const ctx = use(LakeContext);
  if (!ctx) throw new Error('useLake must be used inside <LakeActionsProvider>');
  return ctx;
}

function ViewerProbe({ onState }: { onState: (s: ViewerState) => void }) {
  const state = useViewerState();
  useEffect(() => onState(state), [state, onState]);
  return null;
}

export function LakeActionsProvider({ lake, children }: { lake: LakeInfo; children: ReactNode }) {
  const [session, setSession] = useState<Session>(undefined);
  const [dialog, setDialog] = useState<LakeDialog | null>(null);
  const [source, setSource] = useState<LakeBookingInterestSource>('quick_action');

  const open = useCallback(
    (d: LakeDialog, s?: LakeBookingInterestSource) => {
      if (s) setSource(s);
      if (d === 'share') track('share_lake_button_pressed', { lake_id: lake.documentId, lake_name: lake.name });
      setDialog(d);
    },
    [lake.documentId, lake.name],
  );

  // lakes.detail.c3: the lake becomes the newest of the recently viewed (max 10), per browser.
  useEffect(() => {
    try {
      const current = parseRecentViewedLakeIds(window.localStorage.getItem(RECENT_VIEWED_LAKE_IDS_KEY));
      window.localStorage.setItem(RECENT_VIEWED_LAKE_IDS_KEY, JSON.stringify(pushRecentViewedLakeId(current, lake.documentId)));
    } catch {
      // Storage blocked (private window, preview): the page works without it.
    }
  }, [lake.documentId]);

  const value = useMemo(() => ({ lake, session, open }), [lake, session, open]);
  return (
    <LakeContext value={value}>
      {children}
      <Suspense fallback={null}>
        <ViewerProbe onState={setSession} />
      </Suspense>
      <LakeDialogs lake={lake} session={session} dialog={dialog} source={source} onOpen={open} onClose={() => setDialog(null)} />
      <ClaimAfterSignIn session={session} open={open} />
    </LakeContext>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Booking affordance (fish openBookingAffordance — parity lakes.detail.c16)
 * ---------------------------------------------------------------------------------------------- */

/**
 * What «Rezervă acum» / the Rezervă tile do (fish openBookingAffordance) — the same control at every
 * width, so the page never changes shape when the session probe answers (the page is static; a
 * guest is the common first paint) and works before hydration:
 *  - booking enabled: a link. Known to be signed in → the booking flow (routes.lakeBooking). A guest,
 *    a session not answered yet or an unknown one (rule 4: never assume signed in) → sign-in, back
 *    to this lake (fish pushes /sign-in plainly: Back and the return land on the lake, never inside
 *    the grid). A direct guest visit to /rezerva is redirected by that page itself.
 *  - legacy phone reservations: the jump to Contact (only with a phone number — BookingCta shows
 *    the website or nothing otherwise, bookingReachable);
 *  - no booking: the «Rezervări prin Bluvi» dialog.
 * Every press logs lake_booking_cta_pressed (source, booking_state), as fish.
 */
export function useBookingTarget(source: LakeBookingInterestSource) {
  const { lake, session, open } = useLake();
  const kind = lakeBookingAction(lake.bookingState, true);
  const href =
    kind === 'book'
      ? userOf(session) && lakeHref('booking', routes.lakeBooking(lake.documentId))
        ? routes.lakeBooking(lake.documentId)
        : routes.signIn(routes.lake(lake.documentId))
      : undefined;
  const onPress = (e: MouseEvent<HTMLElement>) => {
    track('lake_booking_cta_pressed', { lake_id: lake.documentId, lake_name: lake.name, source, booking_state: lake.bookingState });
    if (kind === 'interest') open('interest', source);
    else if (kind === 'contact') onSectionJump(e, 'contact');
  };
  return { kind, href, onPress };
}

/**
 * fish guardNavigation for the booking link (booking.b.double-submit-guard, lakes.b.nav-guard): the
 * shell's NavigationGuard drops a second click on the same link within 800 ms; the grid's first
 * render can outlast that window (fish navigates instead of pushing for the same reason), so a
 * plain left click that already started the navigation is ignored while this page is still the one
 * on screen. Back (popstate) and the page being shown again (Activity reveal re-runs the effect)
 * re-arm it; a new-tab click is never guarded.
 */
function useOnceNavigation() {
  const started = useRef(0);
  useEffect(() => {
    started.current = 0;
    const reset = () => {
      started.current = 0;
    };
    window.addEventListener('popstate', reset);
    window.addEventListener('pageshow', reset);
    return () => {
      window.removeEventListener('popstate', reset);
      window.removeEventListener('pageshow', reset);
    };
  }, []);
  return (e: MouseEvent<HTMLElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return true;
    const now = performance.now();
    if (started.current && now - started.current < NAV_PENDING_MS) {
      e.preventDefault();
      return false;
    }
    started.current = now;
    return true;
  };
}
/** How long a started booking navigation keeps the link from starting another one. */
const NAV_PENDING_MS = 10_000;

/**
 * The booking control in a given look: a fragment link (Contact), a link (the booking flow or
 * sign-in) or a dialog button. A plain fragment link (not next/link) for Contact: the browser moves
 * focus with the jump (c16 keyboard).
 */
function BookingControl({ source, className, children }: { source: LakeBookingInterestSource; className?: string; children: ReactNode }) {
  const { kind, href, onPress } = useBookingTarget(source);
  const accept = useOnceNavigation();
  if (kind === 'contact') {
    return (
      <a href="#contact" onClick={onPress} className={className}>
        {children}
      </a>
    );
  }
  return href ? (
    <Link
      href={href}
      onClick={e => {
        if (accept(e)) onPress(e);
      }}
      className={className}
    >
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onPress} aria-haspopup="dialog" className={className}>
      {children}
    </button>
  );
}

/**
 * The booking control's one label per booking state, the same at every width (lakes.detail.c6 /
 * c16, owner rule 4): «Rezervă acum» when the lake books (online, or by phone — it jumps to
 * Contact); «Vreau să rezerv online» when it takes no bookings (`none`), so the phone hero never
 * promises a booking the desktop summary card («Fără rezervări online») says is not there. A
 * deliberate departure from fish c6 (red «Rezervă acum» on every lake): it leads to the same
 * demand signal (lakes.booking-interest), named for what it does.
 */
export function bookingCtaLabel(state: LakeBookingState): string {
  return state === 'none' ? 'Vreau să rezerv online' : 'Rezervă acum';
}

/**
 * The booking control (lakes.detail.c6 / c16): one control, one label per booking state at every
 * width and session state (bookingCtaLabel). The kit primary — `secondary` where a call is the
 * lake's main action (no online booking + a phone), on the phone hero and in the summary card
 * alike. Where it leads: useBookingTarget.
 */
export function BookingCta({
  source,
  block = false,
  variant = 'primary',
  label,
  className,
}: {
  source: LakeBookingInterestSource;
  block?: boolean;
  /** `secondary` + «Vreau să rezerv online»: the summary card while the lake takes no online
   * bookings — the call is the main action then, the demand signal (fish) stays one click away. */
  variant?: 'primary' | 'secondary';
  label?: string;
  className?: string;
}) {
  const { lake } = useLake();
  if (!bookingReachable(lake)) {
    return lake.website ? <WebsiteCta website={lake.website} block={block} className={className} /> : null;
  }
  return (
    <BookingControl source={source} className={buttonClass({ variant, block, className: cn('[&>svg]:size-5', className) })}>
      <CalendarDaysIcon aria-hidden />
      {label ?? bookingCtaLabel(lake.bookingState)}
    </BookingControl>
  );
}

/**
 * «Contactează balta» — a phone-booking lake without a phone number (bookingReachable): its website
 * (fish LakeReservation's website row, contact_pressed «Lake website»), in a new tab. Secondary:
 * it reaches the lake, it does not book.
 */
export function WebsiteCta({ website, block = false, className, children }: { website: string; block?: boolean; className?: string; children?: ReactNode }) {
  const { lake } = useLake();
  return (
    <a
      href={website}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track('contact_pressed', { contact_type: 'Lake website', lake_id: lake.documentId, lake_name: lake.name })}
      className={children ? className : buttonClass({ variant: 'secondary', block, className: cn('[&>svg]:size-5', className) })}
    >
      {children ?? (
        <>
          <GlobeAltIcon aria-hidden />
          Contactează balta
        </>
      )}
      <span className="sr-only"> (se deschide într-o filă nouă)</span>
    </a>
  );
}

/** A quick-action tile's click target for the booking (fish quick action `rezerva`). */
export function BookingTile({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <BookingControl source="quick_action" className={className}>
      {children}
    </BookingControl>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Other triggers
 * ---------------------------------------------------------------------------------------------- */

/**
 * «Distribuie balta» (fish ShareButton → ShareLakeSheet, lakes.detail.c5 / c12): a header chip
 * (phone hero, pinned row) or the kit secondary button from 768 (labelled from 1280).
 */
export function ShareTrigger({
  look = 'chip',
  ground,
  onPhoto = false,
  size,
  className,
}: {
  look?: 'chip' | 'button';
  ground?: HeaderChipGround;
  onPhoto?: boolean;
  size?: string;
  className?: string;
}) {
  const { open } = useLake();
  if (look === 'button') {
    return (
      <button
        type="button"
        onClick={() => open('share')}
        aria-haspopup="dialog"
        title="Distribuie balta"
        className={buttonClass({ variant: 'secondary', className: cn('max-xl:w-12 max-xl:px-0 [&>svg]:size-5', className) })}
      >
        <ShareIcon aria-hidden />
        <span className="max-xl:sr-only">Distribuie</span>
        <span className="sr-only"> balta</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-label="Distribuie balta"
      aria-haspopup="dialog"
      title="Distribuie balta"
      onClick={() => open('share')}
      className={headerChipClass({ ground, onPhoto, size, className })}
    >
      <ShareIcon aria-hidden />
    </button>
  );
}

/** Opens one of the page's dialogs (directions, the reviews explainer, the description, claim). */
export function DialogTrigger({ dialog, className, label, children }: { dialog: LakeDialog; className?: string; label?: string; children: ReactNode }) {
  const { open } = useLake();
  return (
    <button type="button" aria-haspopup="dialog" aria-label={label} onClick={() => open(dialog)} className={className}>
      {children}
    </button>
  );
}

/**
 * fish owner card: the operator, linked to their profile (`href`, once the profile page is on the
 * web) — a guest goes to sign-in first (/feed/anglers/:id 403s anonymously), an unknown session gets
 * the profile link (the profile page gates on its own). lakes.detail.c29.
 */
export function OwnerLink({ href, name, className, children }: { href: string; name: string; className?: string; children: ReactNode }) {
  const { session } = useLake();
  return (
    <Link href={session === null ? routes.signIn(href) : href} aria-label={`${name} — vezi profilul`} className={className}>
      {children}
    </Link>
  );
}

/** fish LakeContactSection#onCall: contact_pressed, then tel:. */
export function PhoneLink({ phone, className, children }: { phone: string; className?: string; children: ReactNode }) {
  const { lake } = useLake();
  return (
    <a
      href={`tel:${phone.replace(/\s+/g, '')}`}
      onClick={() => track('contact_pressed', { contact_type: 'Lake phone contact', lake_id: lake.documentId, lake_name: lake.name })}
      className={className}
    >
      {children}
    </a>
  );
}


/**
 * Back from sign-in with `?dialog=revendica` (ClaimTrigger): opens the claim dialog once the session
 * says signed in, and drops the parameter so a reload or a shared link does not reopen it. Read from
 * `location` (not useSearchParams): the page is static and this is a one-off on mount.
 */
function ClaimAfterSignIn({ session, open }: { session: Session; open: (d: LakeDialog) => void }) {
  useEffect(() => {
    if (session === undefined) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get(CLAIM_PARAM) !== CLAIM_VALUE) return;
    url.searchParams.delete(CLAIM_PARAM);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    if (userOf(session)) open('claim');
  }, [session, open]);
  return null;
}

/**
 * «Ești administratorul acestei bălți?» (lakes.detail.c30): opens the claim dialog. Anyone not known
 * to be signed in (a guest, a session not answered yet, an unknown one) goes to sign-in first — the
 * CMS route needs an account, fish lets the guest fill the form and fail (documented web
 * divergence, lakes.claim.c7 / lakes.b.claim-signed-out) — and comes back to this lake with
 * `?dialog=revendica`, which opens the claim dialog once the session is known (ClaimAfterSignIn).
 */
export function ClaimTrigger({ className, children }: { className?: string; children: ReactNode }) {
  const { lake, session, open } = useLake();
  if (!userOf(session)) {
    return (
      <Link href={routes.signIn(claimReturnPath(lake.documentId))} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" aria-haspopup="dialog" onClick={() => open('claim')} className={className}>
      {children}
    </button>
  );
}
