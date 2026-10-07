'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  Suspense,
  use,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { CalendarDaysIcon, GlobeAltIcon, ShareIcon } from '@heroicons/react/24/outline';
import { headerChipClass, type HeaderChipGround } from '@/components/templates/T3';
import { T4Spinner } from '@/components/templates/T4';
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
 * ClaimTrigger, the dialogs' submits). Only a session KNOWN to be a guest (null) is sent to sign-in
 * up front: /intra is shown to guests only, and the page is static, so its server HTML (and every
 * click before the probe answers) must never send a signed-in angler there. A click while the
 * probe is still out waits for it (`whenSession`) and then routes.
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
  /** The session once the probe answers (undefined if it has not after PROBE_WAIT_MS: treat as unknown). */
  whenSession: () => Promise<Session>;
  open: (dialog: LakeDialog, source?: LakeBookingInterestSource) => void;
  nav: NavGuard;
};

/**
 * fish guardNavigation for the booking controls (booking.b.double-submit-guard, lakes.b.nav-guard):
 * ONE gate for the whole page (the hero, the header, the card, the tile and the phone bar share it,
 * as fish's global hook), so two booking controls clicked in a row start one navigation. `go`
 * starts a navigation unless one is pending and says whether it did; `pendingId` is the control
 * that started it (it shows the spinner + aria-busy). Released when the navigation settles (a
 * failed one included: the transition ends on this page), when the pathname changes (Back
 * included), when the page is shown again (bfcache) and, at the latest, NAV_HOLD_MS after the
 * click.
 */
type NavGuard = {
  go: (id: string, target: (s: Session) => string) => boolean;
  pendingId: string | null;
};

/** How long a started booking navigation keeps every booking control from starting another one. */
const NAV_HOLD_MS = 3_000;
/** How long a click waits for the session probe before routing as «unknown» (the target's own gate decides). */
const PROBE_WAIT_MS = 5_000;

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
  const sessionRef = useRef<Session>(undefined);
  const waiters = useRef<((s: Session) => void)[]>([]);
  const onState = useCallback((s: ViewerState) => {
    sessionRef.current = s;
    setSession(s);
    const ws = waiters.current;
    waiters.current = [];
    ws.forEach(w => w(s));
  }, []);
  const whenSession = useCallback(
    (): Promise<Session> =>
      sessionRef.current !== undefined
        ? Promise.resolve(sessionRef.current)
        : new Promise(resolve => {
            const timer = window.setTimeout(() => resolve(undefined), PROBE_WAIT_MS);
            waiters.current.push(s => {
              window.clearTimeout(timer);
              resolve(s);
            });
          }),
    [],
  );
  const nav = useNavGuard(whenSession);
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

  const value = useMemo(() => ({ lake, session, whenSession, open, nav }), [lake, session, whenSession, open, nav]);
  return (
    <LakeContext value={value}>
      {children}
      <Suspense fallback={null}>
        <ViewerProbe onState={onState} />
      </Suspense>
      <LakeDialogs
        lake={lake}
        session={session}
        whenSession={whenSession}
        dialog={dialog}
        source={source}
        onOpen={open}
        onClose={() => setDialog(null)}
      />
      <ClaimAfterSignIn session={session} open={open} />
    </LakeContext>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Booking affordance (fish openBookingAffordance — parity lakes.detail.c16)
 * ---------------------------------------------------------------------------------------------- */

/** A plain left click: the page handles it; a new-tab click (modifiers, middle button) is the browser's. */
const plainClick = (e: MouseEvent<HTMLElement>) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

function useNavGuard(whenSession: () => Promise<Session>): NavGuard {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  /** The control that started the running navigation, and the page it started on. */
  const [started, setStarted] = useState<{ id: string; path: string } | null>(null);
  /** The same, as refs: a double click's second event must see the first before any render. */
  const hold = useRef<{ at: number; path: string; active: boolean } | null>(null);
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);
  // The navigation settled (it left, or failed and stayed — offline, an RSC error): re-arm at once.
  useEffect(() => {
    if (!pending && hold.current) hold.current.active = false;
  }, [pending]);
  // The page shown again from the back/forward cache.
  useEffect(() => {
    const reset = () => {
      hold.current = null;
      setStarted(null);
    };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  const go = useCallback(
    (id: string, target: (s: Session) => string) => {
      const now = performance.now();
      const h = hold.current;
      // Held while a navigation started here is running — never past NAV_HOLD_MS, never once the
      // pathname moved (the grid, sign-in, Back to this lake).
      if (h && h.active && h.path === pathRef.current && now - h.at < NAV_HOLD_MS) return false;
      hold.current = { at: now, path: pathRef.current, active: true };
      setStarted({ id, path: pathRef.current });
      startTransition(async () => {
        const s = await whenSession();
        startTransition(() => router.push(target(s)));
      });
      return true;
    },
    [router, whenSession],
  );
  const pendingId = pending && started && started.path === pathname ? started.id : null;
  return useMemo(() => ({ go, pendingId }), [go, pendingId]);
}

/**
 * What «Rezervă acum» / the Rezervă tile do (fish openBookingAffordance) — the same control at every
 * width, so the page never changes shape when the session probe answers (the page is static; its
 * HTML is the same for everyone) and works before hydration:
 *  - booking enabled: a link. Known to be a guest (null) → sign-in, back to this lake (fish pushes
 *    /sign-in plainly: Back and the return land on the lake, never inside the grid). Signed in, not
 *    answered yet, or unknown → the booking flow (routes.lakeBooking): fish knows the session at
 *    once, so a signed-in angler never meets sign-in. A click before hydration or a new tab
 *    follows the href, and the grid's own requireViewer gate sends a guest to sign-in (307); a
 *    plain click while the probe is out waits for it, then goes to sign-in (guest) or the grid.
 *  - legacy phone reservations: the jump to Contact (only with a phone number — BookingCta shows
 *    the website or nothing otherwise, bookingReachable);
 *  - no booking: the «Rezervări prin Bluvi» dialog.
 * Every press logs lake_booking_cta_pressed (source, booking_state), as fish.
 */
export function useBookingTarget(source: LakeBookingInterestSource) {
  const { lake, session, open } = useLake();
  const kind = lakeBookingAction(lake.bookingState, true);
  const grid = lakeHref('booking', routes.lakeBooking(lake.documentId));
  const guest = routes.signIn(routes.lake(lake.documentId));
  /** Where the link leads for a given session (only a known guest is sent to sign-in). */
  const target = useCallback((s: Session) => (s === null || !grid ? guest : grid), [grid, guest]);
  const href = kind === 'book' ? target(session) : undefined;
  const onPress = (e: MouseEvent<HTMLElement>) => {
    track('lake_booking_cta_pressed', { lake_id: lake.documentId, lake_name: lake.name, source, booking_state: lake.bookingState });
    if (kind === 'interest') open('interest', source);
    else if (kind === 'contact') onSectionJump(e, 'contact');
  };
  return { kind, href, target, onPress };
}

/**
 * The booking control in a given look: a fragment link (Contact), a link (the booking flow or
 * sign-in) or a dialog button. A plain fragment link (not next/link) for Contact: the browser moves
 * focus with the jump (c16 keyboard). The link's plain left click goes through the page's one
 * NavGuard (it awaits a pending session, then pushes); while that navigation runs, the clicked
 * control shows the spinner and is aria-busy, and every booking control ignores clicks.
 * `children` gets `pending` to swap its icon for the spinner.
 */
function BookingControl({
  source,
  className,
  children,
}: {
  source: LakeBookingInterestSource;
  className?: string;
  children: (pending: boolean) => ReactNode;
}) {
  const { kind, href, target, onPress } = useBookingTarget(source);
  const { nav } = useLake();
  const id = useId();
  const pending = nav.pendingId === id;
  if (kind === 'contact') {
    return (
      <a href="#contact" onClick={onPress} className={className}>
        {children(false)}
      </a>
    );
  }
  return href ? (
    <Link
      href={href}
      aria-busy={pending || undefined}
      onClick={e => {
        if (!plainClick(e)) return onPress(e);
        e.preventDefault();
        if (nav.go(id, target)) onPress(e);
      }}
      className={cn(className, pending && 'cursor-progress')}
    >
      {children(pending)}
      {pending ? <span className="sr-only"> — se deschide…</span> : null}
    </Link>
  ) : (
    <button type="button" onClick={onPress} aria-haspopup="dialog" className={className}>
      {children(false)}
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
      {pending => (
        <>
          {pending ? <T4Spinner /> : <CalendarDaysIcon aria-hidden />}
          {label ?? bookingCtaLabel(lake.bookingState)}
        </>
      )}
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

/** A quick-action tile's click target for the booking (fish quick action `rezerva`); `children` gets `pending`. */
export function BookingTile({ className, children }: { className?: string; children: (pending: boolean) => ReactNode }) {
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
 * `?dialog=revendica` on arrival (back from sign-in, or a click on ClaimTrigger before the session
 * answered): opens the claim dialog once the session says signed in, sends a known guest to sign-in
 * (back here with the parameter), and drops the parameter so a reload or a shared link does not
 * reopen it. Read from `location` (not useSearchParams): the page is static and this is a one-off.
 */
function ClaimAfterSignIn({ session, open }: { session: Session; open: (d: LakeDialog) => void }) {
  const router = useRouter();
  useEffect(() => {
    if (session === undefined) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get(CLAIM_PARAM) !== CLAIM_VALUE) return;
    if (session === null) {
      router.replace(routes.signIn(`${url.pathname}${url.search}`));
      return;
    }
    url.searchParams.delete(CLAIM_PARAM);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    if (userOf(session)) open('claim');
  }, [session, open, router]);
  return null;
}

/**
 * «Ești administratorul acestei bălți?» (lakes.detail.c30): opens the claim dialog. The CMS route
 * needs an account (fish lets the guest fill the form and fail — documented web divergence,
 * lakes.claim.c7 / lakes.b.claim-signed-out):
 *  - signed in → the dialog;
 *  - a known guest (null) → sign-in, back to this lake with `?dialog=revendica`;
 *  - not answered yet / unknown → a link to this lake with `?dialog=revendica` (never /intra, which
 *    is for guests only): before hydration it reloads the lake and ClaimAfterSignIn decides; a plain
 *    click after hydration waits for the probe, then opens the dialog or goes to sign-in.
 */
export function ClaimTrigger({ className, children }: { className?: string; children: ReactNode }) {
  const { lake, session, whenSession, open } = useLake();
  const router = useRouter();
  const [waiting, setWaiting] = useState(false);
  if (userOf(session)) {
    return (
      <button type="button" aria-haspopup="dialog" onClick={() => open('claim')} className={className}>
        {children}
      </button>
    );
  }
  const back = claimReturnPath(lake.documentId);
  return (
    <Link
      href={session === null ? routes.signIn(back) : back}
      aria-busy={waiting || undefined}
      onClick={async e => {
        if (session === null || !plainClick(e)) return;
        e.preventDefault();
        if (waiting) return;
        setWaiting(true);
        const s = await whenSession();
        setWaiting(false);
        if (userOf(s)) open('claim');
        else router.push(routes.signIn(back));
      }}
      className={cn(className, waiting && 'cursor-progress')}
    >
      {children}
    </Link>
  );
}
